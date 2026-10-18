# Pattern 8 — Decorator

**Category:** Cross-cutting behaviour / extensibility
**Stack used in examples:** TypeScript · Node.js · Express · Redis

---

## Theory — why this pattern exists

Decorator is a **structural** pattern: *"Attach additional responsibilities to an
object dynamically. Decorators provide a flexible alternative to subclassing for
extending functionality"* (GoF).

The theory is **composition over inheritance**. If a service needs caching,
logging, metrics, authorization, and auditing, subclassing produces one class per
combination. Wrapping produces one small class per concern, combined at
construction time. Each wrapper implements the same interface, holds the next
layer (`inner`), and adds behaviour before or after delegating.

This is a direct application of:

- **Open/closed principle** — extend behaviour without editing the decorated class.
- **Single responsibility** — the core fetches data; each wrapper owns one concern.
- **Uniform interface** — callers cannot tell how many wrappers are present.

The crucial theoretical detail is that **order defines semantics**. Caching before
authorization can serve data the caller may not see; metrics outside logging
measures different latency than metrics inside. A decorator stack is therefore a
composition with meaning, not a bag of middleware.

Decorator is related to, but distinct from, **proxy** (controls access), **HTTP
middleware** (request pipeline), and **framework interceptors** (handler
execution). Object decorators work across HTTP, jobs, and CLI, which is why they
are the right tool when behaviour must apply outside the web layer.

## Why you need it

You need decorators when one method keeps accumulating concerns:

- `getProduct()` contains logging, timing, caching, authorization, and database
  access in a single body.
- Every new cross-cutting requirement edits the same function and risks the core.
- The core service cannot be tested without Redis, a logger, and a metrics client.
- The same caching or audit behaviour is needed in background jobs, not just HTTP.
- Subclassing for each combination has produced a class explosion.

Without the pattern, the core becomes a maze of concerns, and the team stops
trusting changes to it.

## Benefits

| Benefit | What it gives you |
| --- | --- |
| **Composability** | Behaviours are combined per environment or per route. |
| **Focused core** | The business implementation stays small and readable. |
| **Isolated testing** | Each wrapper is tested with a stub `inner`. |
| **Runtime flexibility** | Caching or metrics can be enabled without editing the service. |
| **Reuse** | The same wrappers serve HTTP, jobs, and CLI entry points. |
| **No subclass explosion** | One wrapper per concern instead of one class per combination. |
| **Localized policy** | Timeouts, retries, audit, and cache TTLs live in one place each. |

The costs are indirection, harder stack traces, order sensitivity, and cache
invalidation work. Three or four wrappers stay readable; ten become a debugging
maze. Never use a decorator to paper over a badly designed core.

## When this pattern applies

Use it when behaviour is optional, composable, and cross-cutting — caching,
logging, metrics, audit, authorization, timeouts — and when it must work outside
the HTTP pipeline. If Express middleware already solves the problem cleanly, or
the wrapper merely hides a single direct call, skip it. Section 7 has the full
decision list.

## 1. What problem does it solve?

A `ProductService` fetches product information. Over time the team wants:

- Caching to reduce database load.
- Logging to debug slow requests.
- Metrics to measure latency.
- Authorization checks.
- Auditing for sensitive operations.

The tempting approach is to keep editing the original service:

```ts
async getProduct(id: string) {
  const start = Date.now();
  logger.info(`getProduct ${id}`);

  const cached = await redis.get(`product:${id}`);
  if (cached) return JSON.parse(cached);

  if (!(await canRead(user, "product", id))) throw new Error("Forbidden");

  const product = await this.repo.findById(id);
  metrics.observe("product.get", Date.now() - start);
  await redis.set(`product:${id}`, JSON.stringify(product), "EX", 60);

  return product;
}
```

After a few iterations the method has five responsibilities, is hard to test, and every new concern edits the same function.

A **decorator** adds behaviour *around* an existing implementation while keeping the same interface. The original service does not know the decorator exists.

## 2. Structure

```mermaid
flowchart LR
    C["Caller"] --> M["MetricsProductService"]
    M --> L["LoggingProductService"]
    L --> K["CachingProductService"]
    K --> D["DatabaseProductService"]
    D --> DB[("PostgreSQL")]
```

All four services implement the same `ProductService` interface, so the caller cannot tell which wrappers are present.

Each wrapper:

- Implements the same interface.
- Holds a reference to `inner` (the next layer).
- Adds behaviour before/after delegating.
- Can short-circuit (e.g. cache hit) — which is why **order matters**.

## 3. Practical TypeScript implementation

### 3.1 Contract and core service

```ts
export type Product = { id: string; name: string; price: number };

export interface ProductService {
  getProduct(id: string): Promise<Product>;
}

export class DatabaseProductService implements ProductService {
  constructor(
    private readonly repository: {
      findById(id: string): Promise<Product | null>;
    },
  ) {}

  async getProduct(id: string): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) throw new Error("Product not found");
    return product;
  }
}
```

### 3.2 Logging decorator

```ts
export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export class LoggingProductService implements ProductService {
  constructor(
    private readonly inner: ProductService,
    private readonly logger: Logger,
  ) {}

  async getProduct(id: string): Promise<Product> {
    const start = Date.now();

    try {
      const result = await this.inner.getProduct(id);
      this.logger.info(`getProduct ${id} ok in ${Date.now() - start}ms`);
      return result;
    } catch (error) {
      // Preserve the error; never convert failure into a fake success.
      this.logger.error(`getProduct ${id} failed: ${String(error)}`);
      throw error;
    }
  }
}
```

### 3.3 Caching decorator

```ts
export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export class CachingProductService implements ProductService {
  constructor(
    private readonly inner: ProductService,
    private readonly cache: Cache,
    private readonly ttlSeconds = 60,
  ) {}

  async getProduct(id: string): Promise<Product> {
    const key = `product:v1:${id}`;
    const cached = await this.cache.get(key);
    if (cached) return JSON.parse(cached) as Product;

    const product = await this.inner.getProduct(id);
    await this.cache.set(key, JSON.stringify(product), this.ttlSeconds);
    return product;
  }
}
```

### 3.4 Metrics decorator

```ts
export interface Metrics {
  observe(name: string, ms: number, labels?: Record<string, string>): void;
}

export class MetricsProductService implements ProductService {
  constructor(
    private readonly inner: ProductService,
    private readonly metrics: Metrics,
  ) {}

  async getProduct(id: string): Promise<Product> {
    const start = process.hrtime.bigint();
    try {
      return await this.inner.getProduct(id);
    } finally {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      this.metrics.observe("product.get.duration_ms", ms, { method: "getProduct" });
    }
  }
}
```

### 3.5 Composition

```ts
const core = new DatabaseProductService(repository);

const cached = new CachingProductService(core, redisCache, 300);
const logged = new LoggingProductService(cached, logger);
const products: ProductService = new MetricsProductService(logged, metrics);

await products.getProduct("product_123");
```

Every layer is independently testable with a fake `inner`. Behaviour can be enabled per environment (no caching in tests, metrics always on).

## 4. Ordering and cache invalidation

Composition order is a design decision, not a detail:

| Order | Consequence |
| --- | --- |
| Metrics → Logging → Cache → DB | Cache hits are still logged and measured (often what you want) |
| Cache → Metrics → Logging → DB | Cache hits bypass logs/metrics entirely — invisible traffic |
| Auth → Cache → DB | Unauthorized calls are rejected before touching cache |
| Cache → Auth → DB | Cached data may be served without a permission check — a security hole |

**Invalidation** must be explicit:

- TTL as a safety net, not the primary strategy for mutable data.
- Delete/refresh keys on write (`updateProduct` → `cache.del("product:v1:" + id)`).
- Version the key namespace (`v1`) so a schema change can be rolled out safely.
- Never share a cache key across users for user-specific data.

Publish invalidation across processes (Redis pub/sub, short TTLs) because each instance may hold its own cached copy.

## 5. Decorator vs. Express middleware vs. proxy

| Mechanism | Typical purpose |
| --- | --- |
| **Object decorator** | Wrap a component with additional behaviour (same interface) |
| **Express middleware** | Process requests/responses at the HTTP pipeline level |
| **Express error middleware** | Centralize error mapping (`(err, req, res, next)`) |
| **Proxy** | Control access to another object (lazy load, permissions, remote calls) |
| **Higher-order function** | Function-level wrapping without classes |

Guidance:

- HTTP concerns (headers, request ids, CORS, body limits, timing) → `app.use(...)` middleware.
- Error mapping → one error-handling middleware at the end of the stack.
- **Service-level** concerns that must also work outside HTTP (jobs, CLI, tests) → object decorator.
- Do not implement the same logging three times at three layers.

Express middleware example (HTTP layer), using the same `Metrics` interface defined above:

```ts
import type { NextFunction, Request, Response } from "express";

export function timingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    metrics.observe("http.duration_ms", ms, {
      method: req.method,
      status: String(res.statusCode),
    });
  });

  next();
}

app.use(timingMiddleware);
```

That measures HTTP requests but does **not** replace a caching decorator around `ProductService`, which must also work for background jobs and CLI commands.

## 6. Production considerations

- **Cache safety.** Never cache sensitive responses under a shared key. Include tenant/user id in the key when the payload is user-specific.
- **Log hygiene.** Never log passwords, tokens, card data, or unnecessary PII. Log identifiers, not payloads.
- **Error preservation.** Decorators must not swallow errors or convert them into empty defaults.
- **Timeouts.** A decorator is a good place to enforce a per-call timeout, but do not stack conflicting timeout policies.
- **Wrapper depth.** Three or four wrappers is readable; ten is a debugging maze. Keep each wrapper single-purpose.
- **Observability of the wrappers.** Metrics/labels should identify the operation, not the class name.
- **Idempotency.** Retry decorators (if used) must not retry non-idempotent operations.
- **Testing.** Test each decorator in isolation with a stub `inner`, plus one composition test.

## 7. When to use / when not to

**Use it when**
- You need optional, composable behaviour around a component.
- Concerns are cross-cutting (caching, logging, metrics, audit, authorization).
- You want to keep the core service focused and testable.
- Behaviour must apply outside the HTTP layer.

**Avoid it when**
- Express middleware already solves it cleanly.
- The extra indirection hides a simple, single call.
- You are using decorators to patch a badly designed core service — fix the core instead.

## 8. Common mistakes

1. Caching before authorization, serving data the caller may not see.
2. Logging full request/response bodies with secrets.
3. Forgetting invalidation on writes → stale data for hours.
4. Silent error conversion (`return null` on failure).
5. Deep wrapper chains with duplicated retries and timeouts.
6. Using a global (singleton) mutable cache without tenant scoping.
7. Testing only the composed stack, so failures cannot be localized.

## 9. Relationship to other patterns

- **Strategy** — decorators can wrap a strategy (e.g. cached pricing).
- **Adapter** — common target for logging/metrics decorators.
- **Repository** — caching decorators around read methods.
- **Circuit breaker** — implemented as a decorator around remote calls.
- **Observer** — decorators can publish metrics/audit events around handlers.
- **Singleton / DI** — stateless decorators are safe shared instances.

## 10. Practice checklist

- [ ] Define the component interface.
- [ ] Implement the core service with one responsibility.
- [ ] Add one decorator per concern.
- [ ] Decide and document the composition order.
- [ ] Implement invalidation for every cached write path.
- [ ] Scrub sensitive fields from logs.
- [ ] Test each decorator in isolation and the stack once.

## 11. One-line takeaway

> Decorator lets you add behaviour without editing the thing being decorated — but the order of wrappers is part of your correctness and security model.

