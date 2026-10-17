# Chapter 4 — Testing and Lifecycle Discipline

> Companion to [`../notes.md`](../notes.md) · Sections 2, 5, and 9
> **Learning goals:** keep singleton state out of test order, build fresh object
> graphs, verify request isolation, and test shutdown without killing the test
> runner.

## 4.1 Why module-level state breaks tests

Three mechanisms cause most flaky suites:

| Mechanism | Symptom | Root cause |
| --- | --- | --- |
| Import-time env reads | Test fails only when another file sets an env var | Config is read while the module loads |
| Mutable static state | Tests pass alone, fail in a suite | Shared `Map`/counter across cases |
| Shared infrastructure | Tests interfere through the same DB rows | One client/pool for the whole worker |

```ts
// config/env.ts — test-hostile
export const config = loadConfig(); // throws on import if DATABASE_URL is absent
```

```ts
// test — forced to manipulate the module system
vi.stubEnv("DATABASE_URL", "postgresql://...");
vi.resetModules();
const { config } = await import("../config/env");
```

`vi.resetModules()` is sometimes necessary, but a codebase that needs it
everywhere has hidden its configuration boundary. Prefer a pure `loadConfig(env)`
and a `create...` factory.

## 4.2 A testable composition root

```ts
// composition-root.ts
export type ContainerDependencies = {
  logger?: Logger;
  prisma?: PrismaClient;
  redis?: Redis;
  orders?: OrderRepository;
};

export function createContainer(
  config: AppConfig,
  deps: ContainerDependencies = {},
): Container {
  const logger = deps.logger ?? createLogger(config.logLevel);
  const prisma = deps.prisma ?? createPrismaClient(config.databaseUrl);
  const redis = deps.redis ?? createRedisClient(config.redisUrl);
  const orders = deps.orders ?? new PrismaOrderRepository(prisma);

  return {
    config,
    logger,
    prisma,
    redis,
    orderService: new OrderService(orders, logger),
    shutdown: async () => {
      await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    },
  };
}
```

Overrides are convenient, but **ownership matters**: if a test passes its own
Prisma client, the container's `shutdown` must not disconnect it.

```ts
const ownsPrisma = deps.prisma === undefined;

shutdown: async () => {
  if (ownsPrisma) await prisma.$disconnect();
  // ...
}
```

For unit tests, skip the production container entirely and build the smallest
graph:

```ts
// tests/support/test-container.ts
import { InMemoryOrderRepository } from "../../src/repositories/in-memory-order.repository";
import { OrderService } from "../../src/services/order.service";
import { createNoopLogger } from "../../src/infrastructure/logger";

export function createTestContainer() {
  const orders = new InMemoryOrderRepository();
  const logger = createNoopLogger();
  const metrics = createMetrics();

  return {
    orders,
    logger,
    metrics,
    orderService: new OrderService(orders, logger),
  };
}
```

Each call returns fresh state. No `beforeEach` reset of globals, no test-order
coupling, no sockets.

## 4.3 Testing configuration

Treat `loadConfig` as a pure function and test the table of failure modes:

```ts
const baseEnv = {
  NODE_ENV: "test",
  PORT: "0",
  DATABASE_URL: "postgresql://app:secret@localhost:5432/orders_test",
  REDIS_URL: "redis://localhost:6379/1",
  LOG_LEVEL: "error",
};

it("coerces PORT", () => {
  expect(loadConfig({ ...baseEnv, PORT: "4100" }).PORT).toBe(4100);
});

it("rejects a missing database URL", () => {
  expect(() => loadConfig({ ...baseEnv, DATABASE_URL: "" })).toThrow(
    /DATABASE_URL/,
  );
});

it("rejects an unknown log level", () => {
  expect(() => loadConfig({ ...baseEnv, LOG_LEVEL: "verbose" })).toThrow(
    /LOG_LEVEL/,
  );
});
```

Coverage worth having:

- defaults for optional values;
- coercion of numeric/boolean strings;
- required production secrets;
- cross-field rules (e.g. `NODE_ENV=production` forbids a sandbox provider);
- error messages that name the variable, so on-call can fix the deploy.

Never mutate `process.env` inside a test when the function accepts an `env`
argument. Reserve `vi.stubEnv` for code you cannot refactor.

## 4.4 Integration tests and shared infrastructure

A real database client is a process-wide resource even in tests. Give each test
file its own client and clean up deterministically:

```ts
import { afterAll, afterEach, beforeAll } from "vitest";
import { createPrismaClient } from "../../src/infrastructure/prisma";

let prisma: ReturnType<typeof createPrismaClient>;

beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is required");
  if (url === process.env.DATABASE_URL) {
    throw new Error("Refusing to run tests against the app database");
  }

  prisma = createPrismaClient(url);
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.order.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

Rules:

- **Never point tests at the application database.** Use a dedicated
  `TEST_DATABASE_URL` and a guard as above.
- **One client per test worker**, not per test case. Connecting per case is slow
  and hides pool bugs.
- **Clean data between cases** (`deleteMany`, truncate, or a rolled-back
  transaction), not by re-running migrations.
- **Run migrations once** in `globalSetup`, not per file.
- **Unique schemas per worker** when files share a database and run in parallel.
- **Testcontainers** is the most reproducible option: start PostgreSQL/Redis once,
  expose the URL, stop in teardown.

If you cannot isolate data, prefer serial execution for that file over a suite
that fails intermittently.

## 4.5 Verifying request isolation

`AsyncLocalStorage` is easy to use and easy to break with `enterWith`. Test it:

```ts
import { describe, expect, it } from "vitest";
import {
  currentRequestContext,
  runWithRequestContext,
} from "../../src/lib/request-context";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readAfterDelay(requestId: string): Promise<string> {
  return runWithRequestContext({ requestId }, async () => {
    await delay(10);
    return currentRequestContext().requestId;
  });
}

describe("request context", () => {
  it("isolates concurrent requests", async () => {
    const [a, b] = await Promise.all([
      readAfterDelay("req-a"),
      readAfterDelay("req-b"),
    ]);

    expect([a, b]).toEqual(["req-a", "req-b"]);
  });

  it("fails loudly outside a request", () => {
    expect(() => currentRequestContext()).toThrow(/No request context/);
  });
});
```

Add an HTTP-level test with Supertest: send two requests with different
`x-request-id` headers to an endpoint that sleeps, and assert the response echoes
the matching id. That catches middleware-order mistakes that unit tests miss.

## 4.6 Testing shutdown without killing the test runner

`process.exit()` in a shutdown handler makes the handler untestable. Inject the
side effects instead:

```ts
// server/shutdown.ts
export type ShutdownDependencies = {
  server: {
    close(callback: (error?: Error) => void): void;
    closeIdleConnections?: () => void;
  };
  closeResources: () => Promise<void>;
  logger: Pick<Logger, "info" | "error">;
  timeoutMs?: number;
  exit?: (code: number) => never;
};

export function createShutdownHandler({
  server,
  closeResources,
  logger,
  timeoutMs = 10_000,
  exit = process.exit,
}: ShutdownDependencies) {
  let started = false;

  return async (signal: string): Promise<void> => {
    if (started) return;
    started = true;

    logger.info({ signal }, "shutting down");

    const forceExit = setTimeout(() => {
      logger.error("forced shutdown after timeout");
      exit(1);
    }, timeoutMs);
    forceExit.unref();

    const closed = new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    server.closeIdleConnections?.();

    await closed;
    await closeResources();

    clearTimeout(forceExit);
    exit(0);
  };
}
```

```ts
it("closes the server before resources, then exits 0", async () => {
  const events: string[] = [];
  const exit = ((code: number) => {
    events.push(`exit:${code}`);
  }) as (code: number) => never;

  const shutdown = createShutdownHandler({
    server: {
      close: (callback) => {
        events.push("server.close");
        callback();
      },
      closeIdleConnections: () => events.push("idle"),
    },
    closeResources: async () => {
      events.push("resources");
    },
    logger: createNoopLogger(),
    exit,
  });

  await shutdown("SIGTERM");

  expect(events).toEqual(["server.close", "idle", "resources", "exit:0"]);
});

it("is idempotent when two signals arrive", async () => {
  // ...same fake, then:
  await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
  expect(events.filter((event) => event === "server.close")).toHaveLength(1);
});
```

The production entry point becomes a thin adapter:

```ts
// server.ts
const shutdown = createShutdownHandler({
  server,
  closeResources: container.shutdown,
  logger: container.logger,
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
```

This is the general rule for singletons: **inject the process edges** (clock,
exit, timers, signals) so the lifecycle logic is ordinary code you can test.

## 4.7 Test anti-patterns

| Anti-pattern | Why it bites | Better |
| --- | --- | --- |
| `getInstance().reset()` in `beforeEach` | Every new state field must be reset manually | Fresh instance per test |
| `vi.resetModules()` everywhere | Slow, obscures the real dependency | `loadConfig(env)` + factories |
| Sharing one Prisma client across files | Cross-file interference | One client per worker, isolated schema |
| Testing against the dev database | Data loss, flaky assertions | `TEST_DATABASE_URL` + guard |
| Importing the production container | Opens sockets and reads real env | `createTestContainer()` |
| Asserting call order through logs | Brittle and slow | Injected fakes with event arrays |
| Relying on file execution order | Passes locally, fails in CI | Independent tests |
| Sleeping to "wait for ALS" | Slow and racy | Await the actual promise |

## 4.8 Checklist

- [ ] Config parsing is a pure function that accepts `env`.
- [ ] Tests build a fresh graph; no module state is reset manually.
- [ ] Unit tests use fakes for infrastructure.
- [ ] Integration tests own their client and clean up in `afterAll`.
- [ ] A guard prevents tests from touching the application database.
- [ ] `AsyncLocalStorage` isolation is covered by a concurrent test.
- [ ] Shutdown accepts injected `exit`/timers and is covered by a test.
- [ ] No test depends on execution order or wall-clock sleeps.

## Exercise

1. Refactor one `getInstance()` dependency into constructor injection and delete
   the static field.
2. Add a `createTestContainer()` helper and remove every `beforeEach` that resets
   global state.
3. Write a Supertest test that sends two concurrent requests with different
   request ids and asserts the echoed ids.
4. Extract shutdown into `createShutdownHandler` and test the event order,
   idempotency, and forced-exit path with fake timers.

---

**Previous:** [Chapter 3 ←](03-infrastructure-singletons.md)
**Next:** [Chapter 5 — Decision guide, anti-patterns, and checklist →](05-decision-guide.md)
**Index:** [Singleton notes](README.md) · **Source:** [`../notes.md`](../notes.md)


