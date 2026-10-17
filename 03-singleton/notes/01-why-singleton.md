# Chapter 1 — Why a Shared Instance Needs an Owner

> Companion to [`../notes.md`](../notes.md) · Sections 1–2
> **Learning goals:** recognise resources that are expensive or inherently
> process-wide, understand what the classic `getInstance()` buys and costs, and
> separate "one instance" from "global access".

## 1.1 Resources that should not be built per request

| Resource | Why one instance per process | Cost of building many |
| --- | --- | --- |
| Configuration | One set of validated values | Different modules read different defaults |
| Logger | One destination, one format | Duplicate transports, interleaved output |
| Database pool | Bounded connections, warm sockets | Pool per request → connection exhaustion |
| Redis client | One multiplexed connection | Socket churn, command queue per request |
| Vendor SDK (Stripe, S3) | One timeout/retry/telemetry setup | Duplicate instrumentation, wasted sockets |
| Metrics registry | One scrape surface per pod | Duplicate series, inconsistent counters |

The pattern is not "make everything global". It is: **some resources have a
lifetime longer than a request, and that lifetime needs an owner.**

## 1.2 The classic implementation

```ts
export class AppConfig {
  private static instance: AppConfig | undefined;

  private constructor(
    public readonly environment: string,
    public readonly databaseUrl: string,
  ) {}

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(
        process.env.NODE_ENV ?? "development",
        process.env.DATABASE_URL ?? "",
      );
    }
    return AppConfig.instance;
  }
}
```

```ts
const a = AppConfig.getInstance();
const b = AppConfig.getInstance();
console.log(a === b); // true
```

This satisfies the narrow definition: one instance, created lazily, reachable
from anywhere. The problems are not in the identity check — they are in the
"reachable from anywhere" part.

## 1.3 What the classic version costs

### Hidden dependencies

```ts
export class OrderService {
  async create(input: CreateOrderInput): Promise<Order> {
    const config = AppConfig.getInstance(); // invisible in the signature
    const logger = Logger.getInstance();

    logger.info("creating order", { environment: config.environment });
    // ...
  }
}
```

`new OrderService()` looks dependency-free. In reality it needs configuration
and a logger, and it reads them from ambient state. You cannot tell from the
constructor what must exist before calling it, and you cannot substitute either
dependency in a unit test.

### Test pollution

```ts
class FeatureFlags {
  private static instance: FeatureFlags | undefined;
  private readonly flags = new Map<string, boolean>();

  static getInstance(): FeatureFlags {
    FeatureFlags.instance ??= new FeatureFlags();
    return FeatureFlags.instance;
  }

  set(name: string, enabled: boolean): void {
    this.flags.set(name, enabled);
  }

  isEnabled(name: string): boolean {
    return this.flags.get(name) ?? false;
  }
}
```

```ts
it("enables refunds", () => {
  FeatureFlags.getInstance().set("refunds", true);
  expect(service.canRefund(order)).toBe(true);
});

it("disables refunds by default", () => {
  expect(service.canRefund(order)).toBe(false); // fails if run second
});
```

The second test passes or fails depending on execution order. Adding a
`beforeEach` that resets every static hides the real issue: production code
depends on mutable ambient state.

### Initialization order is implicit

```ts
const key = process.env.STRIPE_SECRET_KEY!;
```

A missing value becomes `undefined` here and throws on the first live request —
possibly after the pod has passed its health check. Eager initialization in the
composition root turns this into a boot failure instead.

### Shared mutable state interleaves under `await`

Node runs JavaScript on one thread, but `await` yields. Two requests can enter
the same singleton method and interleave:

```ts
class Sequence {
  private value = 1;

  async next(): Promise<number> {
    const current = this.value;
    await new Promise((resolve) => setTimeout(resolve, 5)); // I/O happens here
    this.value = current + 1;
    return current;
  }
}
```

Two concurrent calls both read `1` and return `1`. The same shape appears in
check-then-act caches:

```ts
class UserCache {
  private readonly byId = new Map<string, User>();

  async get(id: string): Promise<User> {
    const cached = this.byId.get(id);
    if (cached) return cached;

    const user = await this.repository.findById(id); // another request can interleave
    this.byId.set(id, user);
    return user;
  }
}
```

Caches are a legitimate singleton, but they need TTL, size limits, and a clear
consistency story. Mutating request-specific data on a shared object is never
legitimate.

### Nobody owns shutdown

A static instance is constructed on first use and has no matching `close()`. Pools
and sockets stay open through deploys, and the process is killed before buffers
flush.

## 1.4 Symptoms that justify a shared instance

| Symptom | What you notice | Fix direction |
| --- | --- | --- |
| Connection exhaustion | `too many clients` after traffic spikes | One pool/client, injected |
| Repeated configuration | Different modules use different env names/defaults | Parse config once at boot |
| Order-dependent tests | Tests pass alone, fail in a suite | Fresh instance per test |
| First-request failures | 500 immediately after deploy | Eager validation at startup |
| Cross-request data | User A sees User B's value | Move state to request scope |
| Slow deploys | Requests time out during shutdown | Own the lifecycle, close pools |

## 1.5 "One instance" is not "global access"

| Mechanism | Scope | Dependency visible? | Easy to test? | Recommended |
| --- | --- | --- | --- | --- |
| Constructor injection + one module instance | Process | Yes | Yes | **Default** |
| Module-level `const` (config, logger) | Process | Partly | Yes, if created by a factory | For immutable/shared infra |
| Static `getInstance()` | Process | No | No | Avoid in application code |
| DI container (`tsyringe`, Awilix) | Process | Partly | Yes | Large graphs only |
| `globalThis` cache | Per realm/process | No | Hard | Dev hot-reload guard only |
| `AsyncLocalStorage` | Async call chain | Via accessor | Yes | Request context |

The useful refactor is not "delete the singleton". It is:

> **Keep one instance. Remove the global accessor. Construct it at the edge and
> pass it in.**

## 1.6 The shape we will build

```ts
// composition-root.ts
export function createContainer(config: AppConfig) {
  const logger = createLogger(config.logLevel);
  const prisma = createPrismaClient(config.databaseUrl);
  const orders = new PrismaOrderRepository(prisma);

  return {
    config,
    logger,
    prisma,
    orders,
    orderService: new OrderService(orders, logger),
  };
}
```

```ts
// server.ts
const config = loadConfig();
const container = createContainer(config);
const app = createApp(container);
```

`container` is a module-scoped value, so Node's module cache gives it one
instance per process. The difference from `getInstance()` is that the dependency
is explicit in every constructor and the graph can be rebuilt in a test.

## 1.7 What "per process" really means

Node evaluates a module once per resolved file per process/realm. That guarantee
has edges worth knowing:

- Two copies of a package (different versions, bad deduplication) can produce two
  module instances with two "singletons".
- `worker_threads` have separate module registries and separate heaps.
- Test runners isolate modules per worker, so each file can get its own instance.
- `globalThis` is per realm, not a cross-process store.
- Five containers mean five independent singletons, five caches, five pools.

That is why a singleton is a **local lifecycle tool**, never a coordination
mechanism. Cross-process coordination belongs to Redis, PostgreSQL, a queue, or
another shared system (chapter 2).

## Exercise

1. List every resource your service creates per request. Mark the ones that are
   expensive or stateful.
2. `grep -rn "getInstance()" src/` and for each call site, write down the hidden
   dependencies it pulls in.
3. Find one test that mutates shared state and would fail if the test order
   changed. Sketch the constructor injection that would remove the shared state.
4. Pick one resource and answer: who creates it, how long does it live, and who
   closes it? If any answer is "nobody", that is the next refactor.

---

**Next:** [Chapter 2 — Scope: process, request, and replica →](02-scope-and-composition.md)
**Index:** [Singleton notes](README.md) · **Source:** [`../notes.md`](../notes.md)

