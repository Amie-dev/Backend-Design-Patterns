# Chapter 3 — Infrastructure Singletons in Express

> Companion to [`../notes.md`](../notes.md) · Sections 3.2, 4, and 8
> **Learning goals:** give every process-wide client one owner, size it correctly,
> and close it in the right order.

## 3.1 Where infrastructure lives

Infrastructure is anything that talks to the outside world or owns an OS
resource: a database pool, a Redis connection, a logger, a metrics registry, a
vendor SDK. Put each in its own file under `infrastructure/` (or `db/` + `lib/`),
and let the composition root construct it.

```text
src/
├── infrastructure/
│   ├── prisma.ts        # factory + (optional) dev singleton
│   ├── redis.ts
│   ├── logger.ts
│   └── metrics.ts
├── composition-root.ts  # creates each once
└── server.ts            # closes them
```

The anti-pattern is not "a module-level instance". It is **an instance with no
owner, no configuration boundary, and no shutdown**.

## 3.2 Prisma: one client, one pool

### Preferred: the composition root owns it

```ts
// infrastructure/prisma.ts
import { PrismaClient } from "@prisma/client";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ["error", "warn"],
  });
}
```

```ts
// composition-root.ts
const prisma = createPrismaClient(config.databaseUrl);
const orders = new PrismaOrderRepository(prisma);
```

```ts
// server.ts (shutdown)
await prisma.$disconnect();
```

The repository receives the client; it never imports a module-level singleton.
Tests can pass a client pointed at a test database, or use a fake repository and
skip Prisma entirely.

### Development hot-reload guard

Frameworks that re-evaluate modules without restarting the process (Next.js dev,
some watch setups) can create a new client on every reload until the pool is
exhausted. The conventional guard caches the client on `globalThis`:

```ts
// infrastructure/prisma.ts (dev-oriented variant)
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL! } },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Use this only when the runtime actually needs it:

- Plain Express with `tsx watch`/`nodemon` restarts the whole process, so the
  module cache already gives one client. The guard is harmless but unnecessary.
- `globalThis` is per realm. It does not make the client shared across containers.
- This variant reads `process.env` at import time, which bypasses eager config
  validation. Prefer the factory + composition root in a validated Express app.

### Pool sizing

Prisma maintains a connection pool per client. Size it against PostgreSQL's
limits, not against request concurrency:

```text
DATABASE_URL="postgresql://app:secret@db:5432/orders?connection_limit=10&pool_timeout=10"
```

- Total connections ≈ replicas × `connection_limit` (+ migrations/admin). Keep it
  below `max_connections` with headroom.
- A larger pool does not fix slow queries; it moves the queue and increases
  contention. Measure query latency first.
- With PgBouncer in transaction mode, use the documented Prisma parameters
  (`pgbouncer=true`) and avoid session-level assumptions.
- Never construct a client per request. That is the fastest way to exhaust
  connections during a traffic spike.

### Health check

```ts
await prisma.$queryRaw`SELECT 1`;
```

Run it in the **readiness** probe, not the liveness probe (section 3.7).

## 3.3 Redis: one client, explicit lifecycle

```ts
// infrastructure/redis.ts
import { Redis } from "ioredis";

export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
```

Rules:

- One client per process is enough; ioredis multiplexes commands over one socket.
  Use a second client only for blocking commands (pub/sub, `BLPOP`) because a
  blocked connection cannot serve normal traffic.
- Fail fast at boot: `lazyConnect: false` connects immediately, and the
  `ready`/`error` events tell you whether startup succeeded.
- Set a retry budget (`maxRetriesPerRequest`) so a Redis outage cannot hold an HTTP
  request open indefinitely.
- Close with `redis.quit()` (graceful, waits for pending replies), not
  `redis.disconnect()` (immediate socket teardown), during shutdown.

Redis is shared infrastructure, **not** an atomic primitive by itself. A lock
needs an owner token and a compare-and-delete release:

```ts
import { randomUUID } from "node:crypto";

const token = randomUUID();
const acquired = await redis.set("lock:order:123", token, "PX", 30_000, "NX");
if (acquired !== "OK") throw new Error("order is being processed");

// Release only if we still own the lock.
await redis.eval(
  `if redis.call("get", KEYS[1]) == ARGV[1]
   then return redis.call("del", KEYS[1])
   else return 0 end`,
  1,
  "lock:order:123",
  token,
);
```

The lock is shared across replicas because it lives in Redis. A process-local
`Map` of locks is not.

## 3.4 Logger: one base, a child per request

```ts
// infrastructure/logger.ts
import pino, { type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;

export function createLogger(level: string, service = "orders-api"): Logger {
  return pino({
    level,
    base: { service },
    redact: {
      paths: [
        "req.headers.authorization",
        "*.password",
        "*.token",
        "*.cardNumber",
      ],
      censor: "[redacted]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
```

```ts
// inside a request
const log = logger.child({ requestId, userId });
log.info({ orderId, durationMs }, "order created");
```

- The base logger is process-wide and immutable.
- `child()` is cheap; create one per request with `requestId`/`userId` so every
  line is correlatable.
- Do not attach request fields by mutating the base logger or a module-level
  "current request" variable.
- Never log secrets, tokens, full card numbers, or raw vendor payloads. Redaction
  paths are a safety net, not a substitute for discipline.
- If you use an async transport/destination, flush it during shutdown; otherwise
  the last lines can be lost.

## 3.5 Metrics: one registry per process

```ts
// infrastructure/metrics.ts
import { Counter, Histogram, Registry } from "prom-client";

export function createMetrics() {
  const registry = new Registry();

  const charges = new Counter({
    name: "payment_charge_total",
    help: "Charge attempts by provider and status",
    labelNames: ["provider", "status"] as const,
    registers: [registry],
  });

  const duration = new Histogram({
    name: "payment_charge_duration_seconds",
    help: "Charge latency",
    labelNames: ["provider"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  return { registry, charges, duration };
}
```

```ts
app.get("/metrics", async (_req, res) => {
  res.set("content-type", metrics.registry.contentType);
  res.send(await metrics.registry.metrics());
});
```

- One registry per process. Each pod exposes its own counters; Prometheus sums
  and rates them.
- Counters reset on restart. Query with `rate()`/`increase()` over a window, not
  as lifetime totals.
- Keep label cardinality bounded. `{ provider, status }` is fine; `{ userId }` or
  `{ orderId }` will destroy your metrics backend.
- Metrics are observability data, not business truth. Reconcile money in the
  database, not in a counter.

## 3.6 Vendor SDKs: configured once, never per request

```ts
// composition-root.ts
const stripe = new Stripe(config.stripeSecretKey, {
  timeout: 5_000,
  maxNetworkRetries: 0, // the retry decorator owns retries (pattern 2)
});

const s3 = new S3Client({
  region: config.awsRegion,
  maxAttempts: 3,
});
```

- SDK clients often own HTTP agents and connection pools. Constructing one per
  request wastes sockets and instrumentation.
- Configure a timeout. An unbounded vendor call consumes the whole request budget
  and prevents graceful shutdown.
- Pick **one** retry owner. `maxNetworkRetries` in the SDK and a retry decorator in
  your code multiply attempts (3 × 3 = 9) and amplify outages.
- Prefer ambient credentials (IAM role, workload identity) over long-lived keys in
  env vars. If keys are required, validate their presence at boot and never log
  them.
- SDK clients are stateless wrappers; sharing is safe as long as you do not mutate
  their configuration later.

## 3.7 Shutdown: stop accepting, drain, close

```ts
// server.ts
const container = createContainer();
const app = createApp(container);
const server = app.listen(container.config.port);

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return; // idempotent: SIGTERM may arrive twice
  shuttingDown = true;

  container.logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    container.logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  // 1. Initiate close, then release idle keep-alive sockets.
  const closed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  server.closeIdleConnections();

  // 2. Wait for in-flight requests to finish.
  await closed;

  // 3. Close pools and flush telemetry only after work has drained.
  await container.shutdown();

  clearTimeout(forceExit);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

Why order matters:

1. **Stop accepting** first; otherwise new requests arrive while you close their
   database pool.
2. **Drain** in-flight requests. `server.close()` stops new connections;
   `closeIdleConnections()` removes idle keep-alive sockets that would otherwise
   delay the close callback.
3. **Close resources** last: `prisma.$disconnect()`, `redis.quit()`, flush logs.
4. **Force exit** on a timer shorter than the orchestrator's grace period.

Kubernetes specifics:

- Set `terminationGracePeriodSeconds` greater than your internal shutdown timeout.
- Use a `preStop` sleep (e.g. 5s) so the load balancer removes the pod before the
  process stops accepting connections.
- Flip readiness to `503` as soon as shutdown starts, then wait for the endpoint
  to propagate.

## 3.8 Liveness and readiness are different

```ts
// liveness: is the process alive? No dependency checks.
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// readiness: can this pod serve traffic right now?
app.get("/ready", async (_req, res) => {
  try {
    await withTimeout(container.prisma.$queryRaw`SELECT 1`, 1_000);
    await withTimeout(container.redis.ping(), 1_000);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});
```

- A liveness probe that checks PostgreSQL restarts every pod during a database
  blip, turning a partial outage into a full one.
- Readiness should check the dependencies needed to serve traffic, with a short
  timeout so the probe does not hang.
- During shutdown, readiness must fail **before** the listener closes; otherwise
  the load balancer keeps sending requests to a dying process.

## 3.9 Resource ownership at a glance

| Resource | Construction cost | Scope | Close | Failure if duplicated |
| --- | --- | --- | --- | --- |
| Config | Parse + validate once | Process | — | Drift, inconsistent defaults |
| Prisma | Pool + sockets | Process | `$disconnect()` | Connection exhaustion |
| Redis | Socket + handshake | Process | `quit()` | Socket churn, duplicate subscriptions |
| Logger | Streams/transport | Process | Flush | Interleaved output, lost lines |
| Metrics | Registry + series | Process | — | Duplicate/incorrect series |
| Stripe/S3 | Agent pool | Process | SDK-specific | Wasted sockets, double retries |
| Request context | Almost free | Request | Async scope ends | Cross-user data leaks |

## Exercise

1. Create `infrastructure/prisma.ts` and `infrastructure/redis.ts` as factories.
   Wire both in a composition root and pass them into repositories.
2. Add `/health` and `/ready`; make `/ready` fail when Redis is stopped.
3. Send `SIGTERM` while a slow request is running. Confirm the request completes,
   then the pool closes, then the process exits.
4. Set `connection_limit=5`, start 4 replicas, and calculate the maximum
   PostgreSQL connections. Leave headroom for migrations and admin access.

---

**Previous:** [Chapter 2 ←](02-scope-and-composition.md)
**Next:** [Chapter 4 — Testing and lifecycle discipline →](04-testing-and-lifecycle.md)
**Index:** [Singleton notes](README.md) · **Source:** [`../notes.md`](../notes.md)


