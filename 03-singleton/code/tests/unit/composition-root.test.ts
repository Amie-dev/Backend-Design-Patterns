import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/infrastructure/cache";
import { DatabasePool } from "../../src/infrastructure/database";
import { createTestContainer } from "../support/test-container";

describe("createContainer", () => {
  it("builds one isolated graph per call", async () => {
    const first = createTestContainer({ seedDemo: true });
    const second = createTestContainer({ seedDemo: true });

    expect(first.pool.id).not.toBe(second.pool.id);
    expect(first.cache.id).not.toBe(second.cache.id);
    expect(first.metrics.id).not.toBe(second.metrics.id);
    expect(first.runtime.instanceId).toBe("test-instance");

    expect(await first.orderService.list("tenant_demo")).toHaveLength(2);
    expect(await first.orderService.list("tenant_other")).toHaveLength(1);

    await first.shutdown();
    await second.shutdown();
  });

  it("shares one pool across the repository and service", async () => {
    const container = createTestContainer();
    expect(container.pool.stats().acquiredTotal).toBe(0);

    await container.orderService.list("tenant_a");

    expect(container.pool.stats().acquiredTotal).toBe(1);
    expect(container.pool.stats().releasedTotal).toBe(1);

    await container.shutdown();
  });

  it("does not close resources owned by the caller", async () => {
    const pool = new DatabasePool({ size: 1, id: "injected" });
    const cache = new TtlCache({ ttlMs: 10, id: "injected_cache" });
    const container = createTestContainer({}, { pool, cache });

    await container.shutdown();

    expect(pool.isClosed).toBe(false);
    expect(cache.isClosed).toBe(false);
    expect(container.runtime.shuttingDown).toBe(true);

    await pool.close();
  });

  it("closes its own pool and cache on shutdown", async () => {
    const container = createTestContainer();
    const { pool, cache } = container;

    await container.shutdown();

    expect(pool.isClosed).toBe(true);
    expect(cache.isClosed).toBe(true);
    expect(container.runtime.shuttingDown).toBe(true);
  });
});
