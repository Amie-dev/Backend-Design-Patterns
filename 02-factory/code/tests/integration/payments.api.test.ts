import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../../src/app";
import { createContainer, type Container } from "../../src/composition-root";
import { testConfig } from "../support/config";

let app: Express;
let container: Container;

beforeEach(() => {
  container = createContainer(
    testConfig({
      seedDemo: true,
      sandboxLatencyMs: 0,
      paymentMaxRetries: 2,
      paymentRetryBaseDelayMs: 0,
    }),
  );
  app = createApp(container);
});

describe("meta endpoints", () => {
  it("GET /health reports provider state", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      providers: ["sandbox"],
      enabled: ["sandbox"],
      defaultProvider: "sandbox",
    });
  });

  it("GET /providers exposes the registry", async () => {
    const response = await request(app).get("/providers").expect(200);

    expect(response.body).toEqual({
      registered: ["sandbox"],
      enabled: ["sandbox"],
      defaultProvider: "sandbox",
      currencyDefaults: {},
      maxRetries: 2,
    });
  });

  it("GET /metrics returns Prometheus text", async () => {
    await request(app).post("/orders/ord_demo_inr/pay").send({}).expect(202);

    const response = await request(app).get("/metrics").expect(200);

    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain(
      'payment_charge_total{provider="sandbox",status="succeeded"} 1',
    );
    expect(response.text).toContain(
      "# TYPE payment_charge_duration_seconds histogram",
    );
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app).get("/nope").expect(404);

    expect(response.body.code).toBe("route_not_found");
  });
});

describe("orders and payments API", () => {
  it("lists seeded orders", async () => {
    const response = await request(app).get("/orders").expect(200);

    expect(response.body.data).toHaveLength(5);
    expect(
      response.body.data.map((order: { id: string }) => order.id),
    ).toContain("ord_demo_paid");
  });

  it("returns an order by id", async () => {
    const response = await request(app).get("/orders/ord_demo_inr").expect(200);

    expect(response.body).toMatchObject({
      id: "ord_demo_inr",
      status: "pending",
      totalCents: 1_999,
      currency: "INR",
      payment: null,
    });
  });

  it("returns 404 for an unknown order", async () => {
    const response = await request(app).get("/orders/ord_missing").expect(404);

    expect(response.body.code).toBe("order_not_found");
  });

  it("charges a pending order and records the payment", async () => {
    const pay = await request(app)
      .post("/orders/ord_demo_inr/pay")
      .send({ provider: "sandbox" })
      .expect(202);

    expect(pay.body).toMatchObject({
      orderId: "ord_demo_inr",
      provider: "sandbox",
      status: "succeeded",
      amountCents: 1_999,
      currency: "INR",
    });
    expect(pay.body.transactionId).toMatch(/^tx_sbx_/);

    const order = await request(app).get("/orders/ord_demo_inr").expect(200);
    expect(order.body.status).toBe("paid");
    expect(order.body.payment).toMatchObject({
      provider: "sandbox",
      status: "succeeded",
      amountCents: 1_999,
      refundableCents: 1_999,
    });

    const payment = await request(app)
      .get("/orders/ord_demo_inr/payment")
      .expect(200);
    expect(payment.body.transactionId).toBe(pay.body.transactionId);
  });

  it("rejects a provider that is not enabled with 422", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_inr/pay")
      .send({ provider: "stripe" })
      .expect(422);

    expect(response.body).toMatchObject({
      code: "unsupported_provider",
      requested: "stripe",
      supported: ["sandbox"],
    });
  });

  it("returns 409 when the order is already paid", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_paid/pay")
      .send({})
      .expect(409);

    expect(response.body).toMatchObject({
      code: "order_not_payable",
      status: "paid",
    });
  });

  it("maps a decline to 402", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_declined/pay")
      .send({})
      .expect(402);

    expect(response.body).toMatchObject({
      code: "payment_declined",
      provider: "sandbox",
      declineCode: "insufficient_funds",
    });
  });

  it("retries a flaky provider and succeeds", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_flaky/pay")
      .send({})
      .expect(202);

    expect(response.body.status).toBe("succeeded");
  });

  it("returns 400 for a malformed body", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_inr/pay")
      .send({ provider: 42 })
      .expect(400);

    expect(response.body.code).toBe("validation_error");
  });

  it("rejects unknown fields instead of silently ignoring them", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_inr/pay")
      .send({ amountCents: 1 })
      .expect(400);

    expect(response.body.code).toBe("validation_error");
  });

  it("returns 404 when an order has no payment", async () => {
    const response = await request(app)
      .get("/orders/ord_demo_inr/payment")
      .expect(404);

    expect(response.body.code).toBe("payment_not_found");
  });
});

describe("refunds API", () => {
  it("refunds the full payment and marks the order refunded", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_paid/refund")
      .send({})
      .expect(202);

    expect(response.body).toMatchObject({
      orderId: "ord_demo_paid",
      provider: "sandbox",
      amountCents: 899,
      refundedCents: 899,
      refundableCents: 0,
    });

    const order = await request(app).get("/orders/ord_demo_paid").expect(200);
    expect(order.body.status).toBe("refunded");
  });

  it("supports a partial refund followed by the remainder", async () => {
    const partial = await request(app)
      .post("/orders/ord_demo_paid/refund")
      .send({ amountCents: 400 })
      .expect(202);

    expect(partial.body).toMatchObject({
      refundedCents: 400,
      refundableCents: 499,
    });

    const rest = await request(app)
      .post("/orders/ord_demo_paid/refund")
      .send({})
      .expect(202);

    expect(rest.body).toMatchObject({
      refundedCents: 899,
      refundableCents: 0,
    });
  });

  it("rejects an over-refund with 409", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_paid/refund")
      .send({ amountCents: 900 })
      .expect(409);

    expect(response.body.code).toBe("refund_exceeds_payment");
  });

  it("rejects a refund for an unpaid order", async () => {
    const response = await request(app)
      .post("/orders/ord_demo_inr/refund")
      .send({})
      .expect(404);

    expect(response.body.code).toBe("payment_not_found");
  });
});

