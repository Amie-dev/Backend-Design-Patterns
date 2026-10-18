import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import type { CustomerRepository } from "../../src/ports/customer.repository";
import { createTestContainer } from "../support/test-container";

const app = createApp(createTestContainer());

const premiumAuth = { Authorization: "Bearer premium-token" };
const studentAuth = { Authorization: "Bearer student-token" };
const guestAuth = { Authorization: "Bearer guest-token" };

const quote = (auth: Record<string, string>, items: unknown[]) =>
  request(app).post("/checkout/quote").set(auth).send({ items });

describe("POST /checkout/quote", () => {
  it("quotes a premium customer with server-side prices", async () => {
    const response = await quote(premiumAuth, [
      { productId: "prod_1", quantity: 2 },
    ]).expect(200);

    expect(response.body).toEqual({
      subtotal: 50_000,
      discount: 7_500,
      total: 42_500,
      strategy: "premium",
    });
  });

  it("gives a guest the festival discount while the campaign is live", async () => {
    const response = await quote(guestAuth, [
      { productId: "prod_2", quantity: 1 },
    ]).expect(200);

    expect(response.body).toEqual({
      subtotal: 15_000,
      discount: 10_000,
      total: 5_000,
      strategy: "festival",
    });
  });

  it("applies precedence: premium beats the campaign", async () => {
    const response = await quote(premiumAuth, [
      { productId: "prod_3", quantity: 1 },
    ]).expect(200);

    expect(response.body.strategy).toBe("premium");
    expect(response.body.discount).toBe(5_250);
  });

  it("applies precedence: a campaign beats the student rate", async () => {
    const response = await quote(studentAuth, [
      { productId: "prod_3", quantity: 1 },
    ]).expect(200);

    expect(response.body.strategy).toBe("festival");
    expect(response.body.discount).toBe(10_000);
  });

  it("returns zero when the cart contains an excluded product", async () => {
    const response = await quote(guestAuth, [
      { productId: "prod_sale", quantity: 1 },
    ]).expect(200);

    expect(response.body).toEqual({
      subtotal: 5_000,
      discount: 0,
      total: 5_000,
      strategy: "festival",
    });
  });

  it("rejects client-supplied prices and customer types", async () => {
    await request(app)
      .post("/checkout/quote")
      .set(guestAuth)
      .send({
        customerType: "premium",
        items: [{ productId: "prod_1", quantity: 1, unitAmount: 1 }],
      })
      .expect(400);
  });

  it("rejects an empty cart", async () => {
    await quote(premiumAuth, []).expect(400);
  });

  it("rejects a non-integer quantity", async () => {
    await quote(premiumAuth, [{ productId: "prod_1", quantity: 1.5 }]).expect(
      400,
    );
  });

  it("requires authentication", async () => {
    await request(app)
      .post("/checkout/quote")
      .send({ items: [{ productId: "prod_1", quantity: 1 }] })
      .expect(401);
  });

  it("rejects an unknown token", async () => {
    await quote({ Authorization: "Bearer nope" }, [
      { productId: "prod_1", quantity: 1 },
    ]).expect(401);
  });

  it("returns 404 for an unknown product", async () => {
    const response = await quote(premiumAuth, [
      { productId: "prod_missing", quantity: 1 },
    ]).expect(404);

    expect(response.body.error).toBe("product_not_found");
  });

  it("returns 422 for an unavailable product", async () => {
    const response = await quote(premiumAuth, [
      { productId: "prod_unavailable", quantity: 1 },
    ]).expect(422);

    expect(response.body.error).toBe("invalid_cart");
  });

  it("echoes a caller-supplied request id", async () => {
    const response = await request(app)
      .post("/checkout/quote")
      .set({ ...guestAuth, "x-request-id": "test-request-123" })
      .send({ items: [{ productId: "prod_1", quantity: 1 }] })
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("test-request-123");
  });
});

describe("read-only endpoints", () => {
  it("reports health", async () => {
    await request(app).get("/health").expect(200, { status: "ok" });
  });

  it("describes the active pricing rules", async () => {
    const response = await request(app).get("/pricing/rules").expect(200);

    expect(response.body.enabledDiscounts).toEqual(["premium", "student"]);
    expect(response.body.precedence).toEqual([
      "premium",
      "festival",
      "student",
      "none",
    ]);
    expect(response.body.festival).toMatchObject({
      enabled: true,
      fixedAmount: 10_000,
      excludedProductIds: ["prod_sale"],
      rolloutPercent: 100,
    });
  });

  it("returns 404 for an unknown route", async () => {
    await request(app).get("/nope").expect(404, { error: "route_not_found" });
  });
});

describe("authentication edge cases", () => {
  it("returns 404 when the authenticated user has no profile", async () => {
    const customers: CustomerRepository = { findById: async () => null };
    const appWithoutCustomers = createApp(createTestContainer({ customers }));

    const response = await request(appWithoutCustomers)
      .post("/checkout/quote")
      .set(guestAuth)
      .send({ items: [{ productId: "prod_1", quantity: 1 }] })
      .expect(404);

    expect(response.body.error).toBe("customer_not_found");
  });
});
