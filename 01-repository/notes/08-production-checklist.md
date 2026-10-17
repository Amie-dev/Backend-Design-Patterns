# Chapter 8 — Production Checklist

> Companion to [`../notes.md`](../notes.md) · Section 5
> **Learning goals:** ship a repository that stays fast, safe, and debuggable
> under real traffic.

## 8.1 Query performance

| Concern | Guidance |
| --- | --- |
| Projection | `select` only the columns the domain needs; avoid loading blobs |
| N+1 | Batch relations with `include` or `in` queries — never per-row queries |
| Indexes | Index every filter + sort combination used by list methods |
| Pagination | Cursor-based for large or changing sets; cap `limit` |
| Counts | Avoid `COUNT(*)` on every page; use `limit + 1` to detect more |
| Locks | Keep transactions short; never call external services inside them |
| `EXPLAIN` | Run `EXPLAIN (ANALYZE, BUFFERS)` on the slowest query before launch |

```ts
// unbounded: will eventually time out
async findAll(): Promise<Order[]> {
  return this.prisma.order.findMany();
}

// bounded and stable
async findPage(page: PageRequest): Promise<Page<Order>> {
  // see chapter 4 for the cursor implementation
}
```

## 8.2 Tenancy and soft deletes

Enforce both **inside** the repository so no caller can forget them:

```ts
export type RequestContext = { tenantId: string };

export class PrismaOrderRepository implements OrderRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ctx: RequestContext,
  ) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findFirst({
      where: { id, tenantId: this.ctx.tenantId, deletedAt: null },
      select: orderSelect,
    });
    return row ? toDomain(row) : null;
  }
}
```

Rules:

- Never accept `tenantId` from the request body or query string; take it from the
  authenticated context.
- Do not make the tenant filter optional "for admin endpoints" — create a
  separate, audited repository instead.
- `deletedAt: null` belongs in every read; deletes become updates.
- For defence in depth, enable PostgreSQL row-level security as well.

## 8.3 Observability

- Log slow queries with parameters redacted; Prisma emits query events via
  `$on("query")` or the `prisma-query-log` style middleware.
- Emit metrics: query duration histogram, error rate by repository method,
  pool saturation.
- Wrap repository calls in tracing spans (`order.repo.findById`) so the database
  time is visible in the request trace.
- Add a correlation/request id to logs; the repository should not generate it,
  but it should propagate through the async context.
- Alert on error rate and p99 latency, not on individual errors.

## 8.4 Resilience

| Failure | Response |
| --- | --- |
| Pool exhausted | Bound concurrency, reduce transaction length, size the pool to the DB limit |
| Slow query | Statement timeout (`statement_timeout`), then fix the query or index |
| Transient connection error | Retry idempotent reads with jitter; do not blind-retry writes |
| Database down | Fail fast with `503`, trip the circuit breaker (pattern 10) |
| Replica lag | Route read-your-writes traffic to the primary |

Set explicit timeouts at every level: HTTP request, Prisma transaction
(`timeout`, `maxWait`), and PostgreSQL `statement_timeout`.

## 8.5 Security

- Prisma parameterises values; never build SQL with template strings. If you use
  `$queryRaw`, use tagged templates with `${}` placeholders.
- Do not return rows straight from the ORM; map to a response DTO so new columns
  are not leaked by accident.
- Validate and whitelist sort/filter fields — `orderBy: req.query.sort` is an
  injection and performance hazard.
- Keep credentials out of logs and error messages.
- Apply least privilege to the database user (no `SUPERUSER`, no `DROP`).

## 8.6 Migrations and change safety

- Every schema change ships as a reviewed migration, not `db push`.
- Add columns as nullable or with defaults; backfill in batches; then add
  constraints.
- Never rename a column and deploy in one step — use expand/contract.
- Test migrations against a production-sized snapshot.
- Keep the repository mapping tolerant during rollout (read both old and new
  columns when necessary).

## 8.7 Pre-ship checklist

- [ ] Every list method is paginated and capped.
- [ ] Indexes match the actual `where` + `orderBy` clauses.
- [ ] No N+1 queries on aggregate reads.
- [ ] Multi-write use cases run in one transaction, owned by the service.
- [ ] Optimistic locking or constraints protect concurrent state changes.
- [ ] Tenant and soft-delete filters cannot be bypassed by callers.
- [ ] Errors are domain errors; driver errors never escape the adapter.
- [ ] Slow-query logging, metrics, and tracing are wired.
- [ ] Timeouts are configured for HTTP, transactions, and SQL.
- [ ] Contract tests run against both the fake and the real adapter.

## Exercise

Take the list endpoint from chapter 4. Add `EXPLAIN (ANALYZE, BUFFERS)`, a
tenant filter, and a `limit` cap. Measure p95 latency before and after adding
the composite index.

---

**Previous:** [Chapter 7 ←](07-transactions-and-consistency.md)
**Next:** [Chapter 9 — Anti-patterns and refactoring →](09-anti-patterns.md)
**Index:** [Repository notes](README.md) · **Source:** [`../notes.md`](../notes.md)
