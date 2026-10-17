# Chapter 4 — The Prisma Adapter

> Companion to [`../notes.md`](../notes.md) · Section 3.2
> **Learning goals:** implement the interface against PostgreSQL without leaking
> Prisma types, handle upserts and driver errors, and index for the queries you
> actually run.

## 4.1 Schema

```prisma
enum OrderStatus {
  pending
  paid
  cancelled
}

model Order {
  id         String      @id @default(cuid())
  userId     String
  totalCents Int
  status     OrderStatus @default(pending)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  items      OrderItem[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
}
```

The composite index matches the list query: filter by `userId`, order by
`createdAt`. Add indexes for the queries you ship, not for every column.

## 4.2 Projection, not `SELECT *`

```ts
import { Prisma, PrismaClient } from "@prisma/client";
import type { Order, Page, PageRequest } from "../domain/order";
import type { OrderRepository } from "../domain/order.repository";
import { orderSelect, toDomain, toPersistence } from "./order.mapper";

type OrderDb = PrismaClient | Prisma.TransactionClient;

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: OrderDb) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      select: orderSelect,
    });
    return row ? toDomain(row) : null;
  }

  async findByUser(userId: string, page: PageRequest): Promise<Page<Order>> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      select: orderSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: page.limit + 1,
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > page.limit;
    const items = (hasMore ? rows.slice(0, -1) : rows).map(toDomain);

    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async save(order: Order): Promise<void> {
    await this.prisma.order.upsert({
      where: { id: order.id },
      create: toPersistence(order),
      update: {
        totalCents: order.totalCents,
        status: order.status,
      },
    });
  }
}
```

Why `take: limit + 1`? It tells you whether another page exists without a second
`count(*)`, which is expensive on large tables. `orderBy` includes `id` as a
tiebreaker so equal timestamps do not produce unstable pages.

## 4.3 Mapping both directions

```ts
// infrastructure/order.mapper.ts
import { Prisma } from "@prisma/client";
import type { Order } from "../domain/order";

export const orderSelect = {
  id: true,
  userId: true,
  totalCents: true,
  status: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export function toDomain(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.userId,
    totalCents: row.totalCents,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toPersistence(order: Order): Prisma.OrderCreateInput {
  return {
    id: order.id,
    userId: order.userId,
    totalCents: order.totalCents,
    status: order.status,
  };
}
```

Mapping is where you absorb schema quirks: legacy column names, nullable fields,
value objects, timezone normalisation. Doing it in one place beats spreading
`row.` access through services.

> Construct the adapter with either a `PrismaClient` or a
> `Prisma.TransactionClient` (chapter 7). Both expose the model delegates used
> here, which is what makes the unit of work possible.

## 4.4 Upsert caveats

- `upsert` requires a unique selector (`id` here).
- `update` does **not** update `createdAt`; Prisma's `@updatedAt` handles
  `updatedAt`.
- `create` must satisfy all required columns. If the domain object lacks a
  column, either give it a default in the schema or set it in `toPersistence`.
- An upsert is not a substitute for optimistic concurrency (chapter 7). Two
  concurrent saves both succeed and the last writer wins.

If insert and update have genuinely different rules, expose `insert` and
`update` instead of `save`. Do not hide a semantic difference behind one verb.

## 4.5 Translating driver errors

```ts
import { Prisma } from "@prisma/client";
import { OrderNotFoundError, RepositoryError } from "../domain/errors";

function translate(error: unknown, orderId: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new RepositoryError("Order already exists", { cause: error });
    }
    if (error.code === "P2025") {
      throw new OrderNotFoundError(orderId);
    }
  }
  throw new RepositoryError("Order persistence failed", { cause: error });
}
```

Call it from the write methods:

```ts
try {
  await this.prisma.order.upsert(/* ... */);
} catch (error) {
  translate(error, order.id);
}
```

The rest of the application never imports `PrismaClientKnownRequestError`.

## 4.6 Avoid N+1 queries

Returning an aggregate usually means loading relations. Two options:

```ts
// one query with a join
await prisma.order.findMany({ include: { items: true } });

// or two batched queries, then group in memory
const orders = await prisma.order.findMany({ where: { userId } });
const items = await prisma.orderItem.findMany({
  where: { orderId: { in: orders.map((o) => o.id) } },
});
```

Never loop over orders and query items per order. If the repository returns a
domain aggregate, it owns the loading strategy and must keep it bounded.

## Exercise

1. Add a `findByStatus` method using the `status` index and cursor pagination.
2. Write a test that proves `save` on a missing row creates it and on an
   existing row updates it.
3. Run `EXPLAIN ANALYZE` on the list query and confirm the composite index is
   used.

---

**Previous:** [Chapter 3 ←](03-domain-model-and-interface.md)
**Next:** [Chapter 5 — Service and Express wiring →](05-service-and-express-wiring.md)
**Index:** [Repository notes](README.md) · **Source:** [`../notes.md`](../notes.md)
