import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import type { Container } from "../../src/composition-root";
import { createTestContainer } from "../support/test-container";

let app: Express;
let container: Container;

beforeEach(() => {
  container = createTestContainer({ seedDemo: true });
  app = createApp(container);
});

afterEach(async () => {
  await container.shutdown();
});

const orderPayload = {
  currency: "USD",
  items: [{ sku: "sku_concurrent", quantity: 1, unitPriceCents: 1_000 }],
};

describe("singleton visibility", () => {
  it("returns the same component ids across requests", async () => {
    const first = await request(app).get("/system/info").expect(200);
    const second = await request(app).get("/system/info").expect(200);

    expect(first.body.components.database.id).toMatch(/^db_/);
    expect(first.body.components.cache.id).toMatch(/^cache_/);
    expect(first.body.components.metrics.id).toMatch(/^metrics_/);

    expect(first.body.components.database.id).toBe(
      second.body.components.database.id,
    );
    expect(first.body.components.cache.id).toBe(
      second.body.components.cache.id,
    );
    expect(first.body.components.metrics.id).toBe(
      second.body.components.metrics.id,
    );
    expect(second.body.requestsServed).toBeGreaterThan(
      first.body.requestsServed,
    );
  });

  it("keeps request context isolated under concurrent requests", async () => {
    const [a, b] = await Promise.all([
      request(app)
        .get("/system/context?delayMs=40")
        .set("x-request-id", "req_a")
        .set("x-tenant-id", "tenant_a")
        .set("x-user-id", "usr_a"),
      request(app)
        .get("/system/context?delayMs=10")
        .set("x-request-id", "req_b")
        .set("x-tenant-id", "tenant_b")
        .set("x-user-id", "usr_b"),
    ]);

    expect(a.body).toMatchObject({
      requestId: "req_a",
      tenantId: "tenant_a",
      userId: "usr_a",
      instanceId: "test-instance",
      scope: "request",
    });
    expect(b.body).toMatchObject({
      requestId: "req_b",
      tenantId: "tenant_b",
      userId: "usr_b",
      instanceId: "test-instance",
      scope: "request",
    });
  });

  it("caps concurrent queries at the configured pool size", async () => {
    const pooled = createTestContainer({
      seedDemo: false,
      dbPoolSize: 2,
      dbQueryDelayMs: 5,
    });
    const pooledApp = createApp(pooled);

    try {
      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          request(pooledApp)
            .post("/orders")
            .set("x-tenant-id", "tenant_a")
            .send({
              currency: "USD",
              items: [
                {
                  sku: `sku_${index}`,
                  quantity: 1,
                  unitPriceCents: 1_000,
                },
              ],
            })
            .expect(201),
        ),
      );

      const stats = await request(pooledApp).get("/system/pool").expect(200);

      expect(stats.body.size).toBe(2);
      expect(stats.body.maxObservedInUse).toBeLessThanOrEqual(2);
      expect(stats.body.acquiredTotal).toBeGreaterThanOrEqual(10);
      expect(stats.body.releasedTotal).toBe(stats.body.acquiredTotal);
      expect(stats.body.inUse).toBe(0);
    } finally {
      await pooled.shutdown();
    }
  });

  it("returns 503 with Retry-After when the pool queue times out", async () => {
    const slow = createTestContainer({
      seedDemo: false,
      dbPoolSize: 1,
      dbQueryDelayMs: 300,
      dbAcquireTimeoutMs: 25,
    });
    const slowApp = createApp(slow);

    try {
      const responses = await Promise.all([
        request(slowApp)
          .post("/orders")
          .set("x-tenant-id", "tenant_a")
          .send(orderPayload),
        request(slowApp)
          .post("/orders")
          .set("x-tenant-id", "tenant_a")
          .send(orderPayload),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        201, 503,
      ]);

      const rejected = responses.find((response) => response.status === 503)!;
      expect(rejected.body.code).toBe("db_pool_timeout");
      expect(rejected.headers["retry-after"]).toBe("1");
    } finally {
      await slow.shutdown();
    }
  });

  it("keeps liveness 200 while readiness fails after the pool closes", async () => {
    await request(app).get("/ready").expect(200);

    await container.pool.close();

    await request(app).get("/health").expect(200);

    const ready = await request(app).get("/ready").expect(503);
    expect(ready.body).toEqual({
      status: "not_ready",
      reason: "pool_closed",
    });
  });

  it("reports draining during shutdown", async () => {
    container.runtime.shuttingDown = true;

    const ready = await request(app).get("/ready").expect(503);
    expect(ready.body).toEqual({ status: "draining" });
  });

  it("exposes Prometheus counters and pool gauges", async () => {
    await request(app).get("/system/pool").expect(200);

    const response = await request(app).get("/metrics").expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("http_requests_total");
    expect(response.text).toContain("# TYPE db_pool_in_use gauge");
    expect(response.text).toContain("db_pool_size");
  });
});
