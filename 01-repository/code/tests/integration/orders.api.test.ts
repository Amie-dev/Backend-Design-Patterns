import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { OrderService } from "../../src/application/order.service";
import { InMemoryOrderRepository } from "../../src/infrastructure/in-memory-order.repository";
import { anOrder } from "../builders/order.builder";

const repo = new InMemoryOrderRepository();
const app = createApp(new OrderService(repo));

beforeEach(() => {
  repo.clear();
  repo.seed(
    anOrder({ id: "ord_api_1", userId: "usr_1", status: "pending" }),
    anOrder({ id: "ord_api_2", userId: "usr_1", status: "paid" }),
    anOrder({ id: "ord_api_3", userId: "usr_2", status: "pending" }),
  );
});

describe("orders API", () => {
  it("GET /health", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("POST /orders creates a pending order", async () => {
    const response = await request(app)
      .post("/orders")
      .send({ userId: "usr_1", totalCents: 2500 })
      .expect(201);

    expect(response.body).toMatchObject({
      userId: "usr_1",
      totalCents: 2500,
      status: "pending",
    });
  });

  it("POST /orders rejects an invalid body", async () => {
    const response = await request(app)
      .post("/orders")
      .send({ userId: "", totalCents: -10 })
      .expect(400);

    expect(response.body.error).toBe("Invalid request");
  });

  it("GET /orders/:id returns an order", async () => {
    const response = await request(app).get("/orders/ord_api_1").expect(200);
    expect(response.body.id).toBe("ord_api_1");
  });

  it("GET /orders/:id returns 404 for an unknown order", async () => {
    const response = await request(app).get("/orders/ord_missing").expect(404);
    expect(response.body.error).toContain("not found");
  });

  it("POST /orders/:id/cancel cancels a pending order", async () => {
    await request(app).post("/orders/ord_api_1/cancel").expect(204);

    const response = await request(app).get("/orders/ord_api_1").expect(200);
    expect(response.body.status).toBe("cancelled");
  });

  it("POST /orders/:id/cancel returns 409 for a paid order", async () => {
    const response = await request(app)
      .post("/orders/ord_api_2/cancel")
      .expect(409);

    expect(response.body.error).toContain("refunded");
  });

  it("GET /orders paginates with a cursor", async () => {
    const first = await request(app)
      .get("/orders?userId=usr_1&limit=1")
      .expect(200);

    expect(first.body.data).toHaveLength(1);
    expect(first.body.nextCursor).toBeTruthy();

    const second = await request(app)
      .get(`/orders?userId=usr_1&limit=1&cursor=${first.body.nextCursor}`)
      .expect(200);

    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
    expect(second.body.nextCursor).toBeNull();
  });

  it("GET /orders requires a userId", async () => {
    const response = await request(app).get("/orders?limit=5").expect(400);
    expect(response.body.error).toBe("Invalid request");
  });
});
