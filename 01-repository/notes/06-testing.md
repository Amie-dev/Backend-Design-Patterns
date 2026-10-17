# Chapter 6 — Testing Repositories

> Companion to [`../notes.md`](../notes.md) · Section 3.5
> **Learning goals:** test business logic without a database, prove that fakes
> and real adapters behave the same, and keep integration tests disposable.

## 6.1 What to test at each level

| Level | Target | Speed | Database |
| --- | --- | --- | --- |
| Unit | `OrderService` with a fake repository | milliseconds | No |
| Contract | Same suite run against fake **and** Prisma adapter | fast / seconds | Optional |
| Integration | Prisma adapter and SQL behaviour | seconds | Yes, disposable |
| End-to-end | Route → service → database | seconds | Yes |

The repository pattern pays off mainly at the first two levels. Do not mock
Prisma's query builder — that tests your mock, not your SQL.

## 6.2 An in-memory fake

```ts
// tests/fakes/in-memory-order.repository.ts
import type { Order } from "../../domain/order";
import type {
  OrderRepository,
  Page,
  PageRequest,
} from "../../domain/order.repository";

export class InMemoryOrderRepository implements OrderRepository {
  private readonly rows = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    const row = this.rows.get(id);
    return row ? structuredClone(row) : null;
  }

  async findByUser(userId: string, page: PageRequest): Promise<Page<Order>> {
    const all = [...this.rows.values()]
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = page.cursor
      ? all.findIndex((order) => order.id === page.cursor) + 1
      : 0;
    const items = all.slice(start, start + page.limit);

    return {
      items: items.map((order) => structuredClone(order)),
      nextCursor:
        start + page.limit < all.length ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async save(order: Order): Promise<void> {
    this.rows.set(order.id, structuredClone(order));
  }

  // Test-only helpers
  seed(...orders: Order[]): void {
    for (const order of orders) {
      this.rows.set(order.id, structuredClone(order));
    }
  }

  clear(): void {
    this.rows.clear();
  }
}
```

`structuredClone` prevents tests from mutating stored state through a returned
object — the same protection a real database gives you.

## 6.3 Unit-testing the service

```ts
// tests/unit/order.service.test.ts
import { describe, expect, it } from "vitest";
import { OrderService } from "../../application/order.service";
import { OrderStateError } from "../../domain/errors";
import { anOrder } from "../builders/order.builder";
import { InMemoryOrderRepository } from "../fakes/in-memory-order.repository";

describe("OrderService.cancel", () => {
  it("cancels a pending order", async () => {
    const repo = new InMemoryOrderRepository();
    const order = anOrder({ status: "pending" });
    repo.seed(order);

    await new OrderService(repo).cancel(order.id);

    expect(await repo.findById(order.id)).toMatchObject({ status: "cancelled" });
  });

  it("refuses to cancel a paid order", async () => {
    const repo = new InMemoryOrderRepository();
    const order = anOrder({ status: "paid" });
    repo.seed(order);

    await expect(new OrderService(repo).cancel(order.id)).rejects.toBeInstanceOf(
      OrderStateError,
    );
    expect(await repo.findById(order.id)).toMatchObject({ status: "paid" });
  });
});
```

The test has no Docker, no migrations, no network, and no Prisma client.

## 6.4 Test data builders

```ts
// tests/builders/order.builder.ts
import type { Order } from "../../domain/order";

let sequence = 0;

export function anOrder(overrides: Partial<Order> = {}): Order {
  sequence += 1;
  return {
    id: `ord_${sequence}`,
    userId: "usr_1",
    totalCents: 1999,
    status: "pending",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

export function resetOrderSequence(): void {
  sequence = 0;
}
```

Builders keep tests readable and make new required fields a one-line change.
Reset the sequence in `beforeEach` if assertions depend on IDs.

## 6.5 Contract tests bind fake and reality

A fake that drifts from the adapter is worse than no fake. Run one suite
against both implementations:

```ts
// tests/contract/order.repository.contract.ts
import { beforeEach, describe, expect, it } from "vitest";
import type { OrderRepository } from "../../domain/order.repository";
import { anOrder } from "../builders/order.builder";

type Harness = {
  repo: OrderRepository;
  reset: () => Promise<void>;
};

export function orderRepositoryContract(
  name: string,
  setup: () => Promise<Harness>,
) {
  describe(`OrderRepository contract: ${name}`, () => {
    let harness: Harness;

    beforeEach(async () => {
      harness = await setup();
      await harness.reset();
    });

    it("returns null for an unknown id", async () => {
      expect(await harness.repo.findById("missing")).toBeNull();
    });

    it("round-trips an order", async () => {
      const order = anOrder();
      await harness.repo.save(order);
      expect(await harness.repo.findById(order.id)).toEqual(order);
    });

    it("paginates without duplicates", async () => {
      const orders = [anOrder(), anOrder(), anOrder()];
      for (const order of orders) await harness.repo.save(order);

      const first = await harness.repo.findByUser("usr_1", { limit: 2 });
      const second = await harness.repo.findByUser("usr_1", {
        limit: 2,
        cursor: first.nextCursor ?? undefined,
      });

      const ids = [...first.items, ...second.items].map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
}
```

```ts
// tests/unit/order.repository.contract.test.ts
import { orderRepositoryContract } from "../contract/order.repository.contract";
import { InMemoryOrderRepository } from "../fakes/in-memory-order.repository";

orderRepositoryContract("in-memory", async () => {
  const repo = new InMemoryOrderRepository();
  return { repo, reset: async () => repo.clear() };
});
```

```ts
// tests/integration/order.repository.contract.test.ts
import { prisma } from "./setup";
import { PrismaOrderRepository } from "../../infrastructure/prisma-order.repository";
import { orderRepositoryContract } from "../contract/order.repository.contract";

orderRepositoryContract("postgres", async () => {
  const repo = new PrismaOrderRepository(prisma);
  return {
    repo,
    reset: async () => {
      await prisma.order.deleteMany();
    },
  };
});
```

Now a behaviour change in either implementation breaks a test.

## 6.6 Integration tests with a disposable database

```ts
// tests/integration/setup.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const container = await new PostgreSqlContainer("postgres:16-alpine").start();
process.env.DATABASE_URL = container.getConnectionUri();

execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
export const prisma = new PrismaClient();

export async function teardown() {
  await prisma.$disconnect();
  await container.stop();
}
```

Guidelines:

- One container per test run, not per test.
- Truncate tables between tests, or wrap each test in a rolled-back transaction.
- Use `db push` for tests and real migrations for production.
- Never point integration tests at a shared development database.

## 6.7 Common mistakes

1. Sharing one fake across tests without resetting it.
2. Using `new Date()` in builders, then asserting exact timestamps.
3. Paginating on a non-unique sort key, producing duplicates or gaps.
4. Mocking `PrismaClient` and asserting call arguments instead of behaviour.
5. Testing Prisma's own CRUD instead of your mapping and constraints.

## Exercise

Run the contract suite against the fake and the real adapter. Then deliberately
break the fake's cursor logic and confirm the contract test fails.

---

**Previous:** [Chapter 5 ←](05-service-and-express-wiring.md)
**Next:** [Chapter 7 — Transactions and consistency →](07-transactions-and-consistency.md)
**Index:** [Repository notes](README.md) · **Source:** [`../notes.md`](../notes.md)


