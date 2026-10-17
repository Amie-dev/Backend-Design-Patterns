# Chapter 3 — Domain Model and Interface Design

> Companion to [`../notes.md`](../notes.md) · Section 3.1
> **Learning goals:** design an interface that speaks domain language, choose
> honest return types, and keep pagination and errors out of the HTTP layer.

## 3.1 Start with the domain type

```ts
// domain/order.ts
export type OrderStatus = "pending" | "paid" | "cancelled";

export type Order = {
  id: string;
  userId: string;
  totalCents: number;
  status: OrderStatus;
  createdAt: Date;
};
```

Rules of thumb:

- Use **domain names**, not column names (`totalCents` is fine if that is the
  domain concept; `order_total_amt` is not).
- Store money as integer minor units. `number` is acceptable for cents below
  `Number.MAX_SAFE_INTEGER`; use `bigint` or a decimal library beyond that.
- Do not import Prisma types into this file. `Prisma.OrderGetPayload<...>` in a
  domain type re-couples the domain to the schema.
- Prefer a closed union over a database enum import. The database enum is an
  implementation detail; the union is the contract.

## 3.2 The interface

```ts
// domain/order.repository.ts
import type { Order } from "./order";

export type PageRequest = { limit: number; cursor?: string };
export type Page<T> = { items: T[]; nextCursor: string | null };

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string, page: PageRequest): Promise<Page<Order>>;
  save(order: Order): Promise<void>;
}
```

Design decisions worth making explicitly:

| Decision | Option A | Option B | Recommendation |
| --- | --- | --- | --- |
| Missing row | `return null` | `throw NotFound` | `null` for lookups; throw in the service |
| List result | `Order[]` | `Page<Order>` | `Page<Order>` for anything user-facing |
| Write | `save` (upsert) | `insert` + `update` | `save` for aggregates; split when the distinction matters |
| Filters | Many parameters | Query object | Query object once there are 3+ filters |
| Deletes | `delete(id)` | `softDelete(id)` | Name the actual behaviour |

> The summary in [`../notes.md`](../notes.md) uses a simpler
> `findByUser(userId): Promise<Order[]>` to keep the first example short. The
> paginated version here is what you should ship.

## 3.3 Pagination types

```ts
export type PageRequest = {
  limit: number;      // clamp to 1..100 in the HTTP layer
  cursor?: string;    // opaque to callers: an order id
};
```

Cursor pagination beats offset pagination when rows change often or the table is
large. The repository returns the cursor; the HTTP layer only forwards it.

```ts
// application/order.service.ts
async listOrders(userId: string, page: PageRequest): Promise<Page<Order>> {
  const limit = Math.min(Math.max(page.limit, 1), 100);
  return this.orders.findByUser(userId, { ...page, limit });
}
```

## 3.4 Query objects for complex filters

```ts
export type OrderFilter = {
  userId?: string;
  status?: OrderStatus;
  createdAfter?: Date;
};

export interface OrderRepository {
  search(filter: OrderFilter, page: PageRequest): Promise<Page<Order>>;
}
```

One method with a filter object beats five near-duplicate methods. Build the
filter in the service from validated input; never pass `req.query` through.

## 3.5 Errors are part of the contract

The repository translates storage failures into domain-meaningful errors:

```ts
// domain/errors.ts
export class OrderNotFoundError extends Error {
  constructor(readonly orderId: string) {
    super(`Order ${orderId} not found`);
    this.name = "OrderNotFoundError";
  }
}

export class OrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStateError";
  }
}

export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}
```

- `OrderNotFoundError` is raised when a write targets a missing row.
- `RepositoryError` wraps unexpected driver/infrastructure failures.
- Prisma error codes (`P2002`, `P2025`) never leave the adapter.
- The HTTP layer (chapter 5) maps these to `404` and `500`.

## 3.6 Segregate reads from writes when it helps

If read models diverge from the write model, split the interface:

```ts
export interface OrderReader {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string, page: PageRequest): Promise<Page<Order>>;
}

export interface OrderWriter {
  save(order: Order): Promise<void>;
}
```

The service can depend on both; a reporting module can depend only on
`OrderReader`. This is the seam that later becomes CQRS (pattern 9) — do not
split prematurely, but do not fight it when the read shapes diverge.

## 3.7 Interface checklist

- [ ] Every method is named in domain language.
- [ ] No Prisma, Express, or SQL types appear in the file.
- [ ] List methods are paginated and bounded.
- [ ] Missing-row behaviour is consistent across methods.
- [ ] Errors are domain errors, not driver errors.
- [ ] The interface contains only what current use cases need.

## Exercise

Write `OrderRepository` for a use case that needs: fetch one order, list a
user's orders newest-first with a cursor, and persist a status change. Then
write the same interface with ORM-style names and compare which one a new
teammate can use without reading the implementation.

---

**Previous:** [Chapter 2 ←](02-concept-and-boundaries.md)
**Next:** [Chapter 4 — The Prisma adapter →](04-prisma-adapter.md)
**Index:** [Repository notes](README.md) · **Source:** [`../notes.md`](../notes.md)
