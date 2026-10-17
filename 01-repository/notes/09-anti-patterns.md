# Chapter 9 — Anti-Patterns and Refactoring

> Companion to [`../notes.md`](../notes.md) · Sections 4 and 7
> **Learning goals:** recognise repositories that add cost without adding a
> boundary, and refactor them safely.

## 9.1 Leaking ORM types

```ts
// ❌ the interface exposes the schema
import type { Prisma } from "@prisma/client";

export interface OrderRepository {
  findById(id: string): Promise<Prisma.OrderGetPayload<{
    include: { items: true };
  }> | null>;
}
```

```ts
// ✅ domain type; relations are an implementation detail
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
}
```

Symptom: services import `@prisma/client`, and schema changes ripple everywhere.

## 9.2 The generic base repository

```ts
// ❌ type-unsafe and query-ignorant
export class BaseRepository<T> {
  constructor(private model: any) {}
  findMany(where: any): Promise<T[]> { return this.model.findMany({ where }); }
  update(id: string, data: any) { return this.model.update({ where: { id }, data }); }
}
```

```ts
// ✅ explicit contract per aggregate
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
}
```

`BaseRepository` pushes `where` objects and `any` back into services, which is
exactly what the pattern was meant to prevent.

## 9.3 One repository per table

```text
❌ OrderRepository, OrderItemRepository, PaymentRepository, AddressRepository
✅ OrderRepository (aggregate), PaymentRepository (own lifecycle)
```

Mapping every table produces chatty services that assemble aggregates
themselves and can persist half an aggregate. Model aggregate roots.

## 9.4 Business rules in the repository

```ts
// ❌ business decision hidden in data access
async cancelPaidOrder(id: string) {
  await this.prisma.order.update({ where: { id }, data: { status: "cancelled" } });
}
```

```ts
// ✅ the service decides; the repository persists
async cancel(id: string): Promise<void> {
  const order = await this.orders.findById(id);
  if (!order) throw new OrderNotFoundError(id);
  if (order.status === "paid") throw new OrderStateError("Refund instead");

  await this.orders.save({ ...order, status: "cancelled" });
}
```

## 9.5 Unbounded queries

```ts
// ❌ "just in case"
findAll(): Promise<Order[]>;
```

On a table that grows, this is a future outage. Provide `findPage` with a cap,
or a dedicated streaming/reporting method with an explicit contract.

## 9.6 Chatty repository and N+1

```ts
// ❌ one query per order
const orders = await repo.findAll();
for (const order of orders) order.items = await repo.findItems(order.id);
```

```ts
// ✅ the repository owns the loading strategy
const orders = await repo.findByUser(userId, { limit: 20 });
// implementation uses include or a single batched `in` query
```

## 9.7 Transactions hidden inside the repository

```ts
// ❌ each call commits; the use case cannot be atomic
async save(order: Order) {
  await this.prisma.$transaction([/* ... */]);
}
```

A repository method may use a transaction internally for a single aggregate, but
cross-aggregate atomicity belongs to the service via a unit of work (chapter 7).
Double transactions also make retries and tests harder.

## 9.8 HTTP shapes in the repository

```ts
// ❌ persistence coupled to the transport
async getOrderDto(id: string) {
  return { id, status, _links: { self: `/orders/${id}` } };
}
```

Return domain objects. Map to response DTOs in the HTTP layer so the API can
change without touching SQL.

## 9.9 The god repository

Symptoms: 40 methods, unrelated aggregates, `searchEverything()`, half the
service logic. Split by aggregate or by read/write responsibility (chapter 3).
A good repository has a name you can say out loud.

## 9.10 Repository as a service locator

```ts
// ❌ hidden dependency, untestable
class OrderService {
  async cancel(id: string) {
    const repo = container.resolve<OrderRepository>("OrderRepository");
    // ...
  }
}
```

Inject through the constructor or function parameter. The composition root is
the only place that resolves implementations.

## 9.11 Refactoring playbook

1. **Freeze behaviour:** add tests around the current route/service output.
2. **Extract the interface** using domain types, not ORM types.
3. **Move queries** one method at a time into the adapter; keep the old path
   working until each call site is migrated.
4. **Replace the fake** with the in-memory implementation and run the contract
   suite (chapter 6).
5. **Delete the old query code**, then add pagination, tenancy filters, and
   indexes.
6. **Measure** before and after; if the repository only forwards calls, stop and
   revert.

## Exercise

Find a service method with three or more direct ORM calls. Extract one method
into a repository, add a contract test, and leave the other calls for a
follow-up. Refactor in small, reversible steps.

---

**Previous:** [Chapter 8 ←](08-production-checklist.md)
**Next:** [Chapter 10 — Decision guide and summary →](10-decision-guide-and-summary.md)
**Index:** [Repository notes](README.md) · **Source:** [`../notes.md`](../notes.md)
