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

describe("orders API", () => {
  it("lists orders for the default tenant", async () => {
    const response = await request(app).get("/orders").expect(200);

    expect(response.body.meta.count).toBe(2);
    expect(response.body.data.map((order: { id: string }) => order.id)).toEqual(
      ["ord_demo_usd", "ord_demo_inr"],
    );
  });

  it("scopes the list to the x-tenant-id header", async () => {
    const response = await request(app)
      .get("/orders")
      .set("x-tenant-id", "tenant_other")
      .expect(200);

    expect(response.body.meta.count).toBe(1);
    expect(response.body.data[0].id).toBe("ord_demo_other");
  });

  it("returns an order by id", async () => {
    const response = await request(app).get("/orders/ord_demo_usd").expect(200);

    expect(response.body).toMatchObject({
      id: "ord_demo_usd",
      tenantId: "tenant_demo",
      totalCents: 17_998,
      currency: "USD",
      status: "pending",
    });
  });

  it("returns 404 for an unknown order", async () => {
    const response = await request(app)
      .get("/orders/ord_missing")
      .expect(404);

    expect(response.body.code).toBe("order_not_found");
  });

  it("does not leak another tenant's order", async () => {
    const response = await request(app)
      .get("/orders/ord_demo_other")
      .set("x-tenant-id", "tenant_demo")
      .expect(404);

    expect(response.body.code).toBe("order_not_found");
  });

  it("creates an order from request-scoped identity", async () => {
    const response = await request(app)
      .post("/orders")
      .set("x-tenant-id", "tenant_a")
      .set("x-user-id", "usr_a")
      .set("x-request-id", "req_create")
      .send({
        currency: "USD",
        items: [
          { sku: "sku_a", quantity: 2, unitPriceCents: 1_500 },
          { sku: "sku_b", quantity: 1, unitPriceCents: 250 },
        ],
      })
      .expect(201);

    expect(response.headers["x-request-id"]).toBe("req_create");
    expect(response.headers["x-instance-id"]).toBe("test-instance");
    expect(response.body).toMatchObject({
      tenantId: "tenant_a",
      userId: "usr_a",
      totalCents: 3_250,
      currency: "USD",
      status: "pending",
    });
    expect(response.body.id).toMatch(/^ord_/);
  });

  it("rejects an empty item list at the HTTP boundary", async () => {
    const response = await request(app)
      .post("/orders")
      .set("x-tenant-id", "tenant_a")
      .send({ currency: "USD", items: [] })
      .expect(400);

    expect(response.body.code).toBe("validation_error");
  });

  it("rejects malformed JSON with a 400", async () => {
    const response = await request(app)
      .post("/orders")
      .set("content-type", "application/json")
      .send('{"items":')
      .expect(400);

    expect(response.body.code).toBe("invalid_json");
  });

  it("cancels a pending order and refuses a second cancel", async () => {
    const created = await request(app)
      .post("/orders")
      .set("x-tenant-id", "tenant_a")
      .send({
        currency: "USD",
        items: [{ sku: "sku", quantity: 1, unitPriceCents: 900 }],
      })
      .expect(201);

    const cancelled = await request(app)
      .post(`/orders/${created.body.id}/cancel`)
      .set("x-tenant-id", "tenant_a")
      .expect(200);

    expect(cancelled.body.status).toBe("cancelled");

    const conflict = await request(app)
      .post(`/orders/${created.body.id}/cancel`)
      .set("x-tenant-id", "tenant_a")
      .expect(409);

    expect(conflict.body.code).toBe("order_not_pending");
  });

  it("serves the second read from the process cache", async () => {
    await request(app).get("/orders/ord_demo_usd").expect(200);
    await request(app).get("/orders/ord_demo_usd").expect(200);

    const stats = await request(app).get("/system/cache").expect(200);

    expect(stats.body.hits).toBeGreaterThanOrEqual(1);
    expect(stats.body.entries).toBeGreaterThanOrEqual(1);
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app).get("/nope").expect(404);

    expect(response.body.code).toBe("route_not_found");
  });
});
