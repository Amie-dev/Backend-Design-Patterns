# Chapter 10 — Decision Guide and Summary

> Companion to [`../notes.md`](../notes.md) · Sections 6, 8–10
> **Learning goals:** decide whether a repository is justified, choose the right
> alternative, and connect it to the other nine patterns.

## 10.1 Decision matrix

| Situation | Recommendation |
| --- | --- |
| Small CRUD service, one storage, no invariants | Use the ORM directly |
| Business logic needs unit tests without a database | Repository + in-memory fake |
| Repeated complex queries across services | Repository with intention-revealing methods |
| Likely to swap ORM or support another store | Repository behind an interface |
| Complex ad-hoc reporting | Read/query service, not a repository |
| Read and write models diverge | CQRS (pattern 9), repositories on the write side |
| Multiple writes must be atomic | Unit of work + repository, owned by the service |
| Cross-service workflow | Sagas/outbox, not a distributed transaction |

If you cannot name the boundary the repository hides, you probably do not need
it yet.

## 10.2 Alternatives

| Alternative | Use when | Cost |
| --- | --- | --- |
| Direct ORM in service | Thin CRUD, stable schema | Harder to test, schema leaks |
| Query service / read model | Reporting, dashboards, search | Separate model to maintain |
| CQRS | Different read and write shapes | More moving parts, eventual consistency |
| Event sourcing | Audit is the core requirement | Steep complexity |
| Active Record | Small apps, framework conventions | Business logic tends to leak into models |

A repository and a query service can coexist: commands go through the aggregate
repository, queries through a read-optimised service.

## 10.3 Incremental adoption

1. Pick one use case with real invariants (cancel, refund, approve).
2. Write the interface in domain language.
3. Implement it with Prisma, mapping rows explicitly.
4. Add the in-memory fake and a contract suite.
5. Wire it in the composition root; leave other routes untouched.
6. Repeat only where the same symptoms appear (chapter 1).

This is a strangler approach: no big-bang rewrite, and every step is reversible.

## 10.4 Relationship to the other patterns

| Pattern | Connection |
| --- | --- |
| **Adapter (7)** | A repository is an adapter between domain language and a database API |
| **Factory (2)** | Selects the repository implementation per environment |
| **Singleton / DI (3)** | Prisma client and repositories are wired once at startup |
| **Decorator (8)** | Caching or logging repositories wrap a real one behind the same interface |
| **Observer (5)** | Outbox events are written in the same transaction as the aggregate |
| **CQRS (9)** | Write repositories enforce invariants; read models serve queries |
| **Circuit breaker (10)** | Wraps remote repositories/clients, not the local database |
| **Unit of work (7)** | Gives several repositories one transaction |

## 10.5 Final checklist

- [ ] The interface uses domain types only.
- [ ] Implementations live in infrastructure and are wired once.
- [ ] One repository per aggregate root, not per table.
- [ ] List methods are paginated, bounded, and indexed.
- [ ] Tenant and soft-delete filters are enforced inside the adapter.
- [ ] Driver errors are translated into domain errors.
- [ ] Multi-write use cases share a transaction owned by the service.
- [ ] Concurrency is handled with constraints or optimistic locking.
- [ ] A fake and a contract suite keep tests fast and honest.
- [ ] The abstraction hides a real boundary — not just a renamed ORM.

## 10.6 One-line takeaway

> A repository is worth its weight only when it hides a *meaningful* boundary —
> not when it merely renames the ORM.

## Further reading

- Martin Fowler, *Patterns of Enterprise Application Architecture* — Repository,
  Unit of Work, Data Mapper.
- Martin Fowler, [Repository](https://martinfowler.com/eaaCatalog/repository.html)
- Prisma docs, [Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- PostgreSQL docs, [Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)
- Eric Evans, *Domain-Driven Design* — aggregates and repositories.

---

**Previous:** [Chapter 9 ←](09-anti-patterns.md)
**Index:** [Repository notes](README.md) · **Summary:** [`../notes.md`](../notes.md)
