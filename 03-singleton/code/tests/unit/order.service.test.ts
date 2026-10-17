import { describe, expect, it } from "vitest";
import {
  InvalidOrderError,
  OrderNotFoundError,
  OrderNotPendingError,
} from "../../src/errors/app.errors";
import { TtlCache } from "../../src/infrastructure/cache";
import { createNoopLogger } from "../../src/lib/logger";
import { MetricsRegistry } from "../../src/lib/metrics";
import type { Order } from "../../src/models/order.model";
import { OrderService } from "../../src/services/order.service";
import { InMemoryOrderRepository } from "../fakes/in-memory-order.repository";

const actor = { tenantId: "tenant_a", userId: "usr_a" };

function makeOrder(overrides: Partial<Order> = {}): Order {
  const timestamp = "2026-01-01T00:00:00.000Z";

  return {
    id: "ord_seed",
    tenantId: "tenant_a",
    userId: "usr_a",
    items: [{ sku: "sku_1", quantity: 1, unitPriceCents: 1_000 }],
    totalCents: 1_000,
    currency: "USD",
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function setup() {
  let nowMs = Date.parse("2026-01-01T00:00:00.000Z");
  let id = 0;
  const repository = new InMemoryOrderRepository();
  const cache = new TtlCache({
    ttlMs: 60_000,
    id: "cache_test",
    now: () => nowMs,
  });
  const metrics = new MetricsRegistry("metrics_test");
  const service = new OrderService({
    orders: repository,
    cache,
    metrics,
    logger: createNoopLogger(),
    clock: () => new Date((nowMs += 1)),
    idFactory: () => `ord_${++id}`,
  });

  return { repository, cache, metrics, service };
}

describe("OrderService", () => {
  it("computes the total on the server and stores actor identity", async () => {
    const { repository, metrics, service } = setup();

    const order = await service.create(
      {
        currency: "USD",
        items: [
          { sku: "sku_a", quantity: 2, unitPriceCents: 500 },
          { sku: "sku_b", quantity: 1, unitPriceCents: 250 },
        ],
      },
      actor,
    );

    expect(order).toMatchObject({
      id: "ord_1",
      tenantId: "tenant_a",
      userId: "usr_a",
      totalCents: 1_250,
      status: "pending",
    });
    expect(repository.orders.get("ord_1")).toEqual(order);
    expect(
      metrics.counterValue("orders_created_total", { tenant: "tenant_a" }),
    ).toBe(1);
  });

  it("rejects an empty item list even if validation is bypassed", async () => {
    const { service } = setup();

    await expect(
      service.create({ currency: "USD", items: [] }, actor),
    ).rejects.toBeInstanceOf(InvalidOrderError);
  });

  it("caches a get by tenant and id", async () => {
    const { repository, cache, metrics, service } = setup();
    repository.seed(makeOrder());

    await service.getById("ord_seed", "tenant_a");
    await service.getById("ord_seed", "tenant_a");

    expect(repository.findByIdCalls).toBe(1);
    expect(cache.stats().hits).toBe(1);
    expect(
      metrics.counterValue("cache_events_total", {
        operation: "get",
        result: "hit",
      }),
    ).toBe(1);
  });

  it("returns 404 semantics for another tenant's order", async () => {
    const { repository, service } = setup();
    repository.seed(makeOrder({ tenantId: "tenant_b" }));

    await expect(
      service.getById("ord_seed", "tenant_a"),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("caches lists per tenant", async () => {
    const { repository, service } = setup();
    repository.seed(
      makeOrder({ id: "ord_a1", tenantId: "tenant_a" }),
      makeOrder({ id: "ord_a2", tenantId: "tenant_a" }),
      makeOrder({ id: "ord_b1", tenantId: "tenant_b" }),
    );

    expect(await service.list("tenant_a")).toHaveLength(2);
    expect(await service.list("tenant_b")).toHaveLength(1);
    expect(await service.list("tenant_a")).toHaveLength(2);

    expect(repository.listByTenantCalls).toBe(2);
  });

  it("invalidates the tenant list after a create", async () => {
    const { repository, service } = setup();
    repository.seed(makeOrder({ id: "ord_seed" }));

    expect(await service.list("tenant_a")).toHaveLength(1);

    await service.create(
      { currency: "USD", items: [{ sku: "sku", quantity: 1, unitPriceCents: 900 }] },
      actor,
    );

    expect(await service.list("tenant_a")).toHaveLength(2);
    expect(repository.listByTenantCalls).toBe(2);
  });

  it("cancels a pending order and invalidates its cache entry", async () => {
    const { repository, cache, metrics, service } = setup();
    repository.seed(makeOrder());

    await service.getById("ord_seed", "tenant_a");
    const cancelled = await service.cancel("ord_seed", "tenant_a");

    expect(cancelled.status).toBe("cancelled");
    expect(repository.orders.get("ord_seed")?.status).toBe("cancelled");
    expect(cache.get("orders:tenant_a:item:ord_seed:v1")).toBeUndefined();
    expect(
      metrics.counterValue("orders_cancelled_total", { tenant: "tenant_a" }),
    ).toBe(1);
  });

  it("refuses to cancel a non-pending order", async () => {
    const { repository, service } = setup();
    repository.seed(makeOrder({ status: "cancelled" }));

    await expect(
      service.cancel("ord_seed", "tenant_a"),
    ).rejects.toBeInstanceOf(OrderNotPendingError);
  });

  it("reports an unknown order when cancelling", async () => {
    const { service } = setup();

    await expect(
      service.cancel("ord_missing", "tenant_a"),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});
