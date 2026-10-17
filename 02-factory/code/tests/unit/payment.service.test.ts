import { describe, expect, it } from "vitest";
import { createPaymentModule } from "../../src/composition-root";
import type { Config } from "../../src/config/env";
import {
  OrderNotPayableError,
  PaymentNotFoundError,
  RefundExceedsPaymentError,
  UnsupportedProviderError,
} from "../../src/errors/payment.errors";
import { createNoopLogger } from "../../src/lib/logger";
import { MetricsRegistry } from "../../src/lib/metrics";
import type { Order } from "../../src/models/order.model";
import { InMemoryOrderRepository } from "../../src/repositories/in-memory-order.repository";
import { aPaidOrder, anOrder } from "../builders/order.builder";
import { FakePaymentProvider } from "../fakes/fake-payment.provider";
import { testConfig } from "../support/config";

type SetupOptions = {
  providers?: FakePaymentProvider[];
  order?: Order;
  config?: Partial<Config>;
  metrics?: MetricsRegistry;
};

function setup(options: SetupOptions = {}) {
  const providers = options.providers ?? [new FakePaymentProvider("sandbox")];
  const orders = new InMemoryOrderRepository();
  const metrics = options.metrics ?? new MetricsRegistry();

  orders.seed(options.order ?? anOrder());

  const module = createPaymentModule(testConfig(options.config), {
    orders,
    providers,
    metrics,
    logger: createNoopLogger(),
  });

  return { providers, orders, metrics, module };
}

describe("PaymentService.pay", () => {
  it("charges the order amount with a deterministic idempotency key", async () => {
    const { providers, orders, metrics, module } = setup();

    const result = await module.payments.pay("ord_1");

    expect(result).toEqual({
      orderId: "ord_1",
      provider: "sandbox",
      transactionId: "tx_sandbox_1",
      status: "succeeded",
      amountCents: 1_999,
      currency: "INR",
    });
    expect(providers[0]!.charges).toEqual([
      {
        orderId: "ord_1",
        amountCents: 1_999,
        currency: "INR",
        idempotencyKey: "order:ord_1:pay:v1",
      },
    ]);

    const saved = await orders.findById("ord_1");
    expect(saved?.status).toBe("paid");
    expect(saved?.payment).toMatchObject({
      provider: "sandbox",
      transactionId: "tx_sandbox_1",
      status: "succeeded",
      amountCents: 1_999,
    });

    expect(
      metrics.counterValue("payment_charge_total", {
        provider: "sandbox",
        status: "succeeded",
      }),
    ).toBe(1);
    expect(
      metrics.histogramCount("payment_charge_duration_seconds", {
        provider: "sandbox",
      }),
    ).toBe(1);
  });

  it("uses the provider requested by the caller", async () => {
    const sandbox = new FakePaymentProvider("sandbox");
    const stripe = new FakePaymentProvider("stripe");

    const { module } = setup({
      providers: [sandbox, stripe],
      config: { enabledProviders: ["sandbox", "stripe"] },
    });

    const result = await module.payments.pay("ord_1", "STRIPE");

    expect(result.provider).toBe("stripe");
    expect(stripe.charges).toHaveLength(1);
    expect(sandbox.charges).toHaveLength(0);
  });

  it("rejects an unknown provider and records the attempt", async () => {
    const { metrics, module } = setup();

    await expect(module.payments.pay("ord_1", "paypal")).rejects.toBeInstanceOf(
      UnsupportedProviderError,
    );

    expect(
      metrics.counterValue("payment_provider_unknown_total", {
        requested: "paypal",
      }),
    ).toBe(1);
  });

  it("keeps a pending charge pending and records it", async () => {
    const sandbox = new FakePaymentProvider("sandbox").willReturn({
      transactionId: "tx_pending",
      status: "pending",
    });

    const { orders, module } = setup({ providers: [sandbox] });

    const result = await module.payments.pay("ord_1");

    expect(result.status).toBe("pending");

    const saved = await orders.findById("ord_1");
    expect(saved?.status).toBe("pending");
    expect(saved?.payment?.status).toBe("pending");
  });

  it("does not record a failed charge", async () => {
    const sandbox = new FakePaymentProvider("sandbox").willReturn({
      transactionId: "tx_failed",
      status: "failed",
    });

    const { orders, module } = setup({ providers: [sandbox] });

    const result = await module.payments.pay("ord_1");

    expect(result.status).toBe("failed");

    const saved = await orders.findById("ord_1");
    expect(saved?.status).toBe("pending");
    expect(saved?.payment).toBeUndefined();
  });

  it("refuses to charge an order that is not pending", async () => {
    const { module } = setup({ order: aPaidOrder({ id: "ord_paid" }) });

    await expect(module.payments.pay("ord_paid")).rejects.toBeInstanceOf(
      OrderNotPayableError,
    );
  });
});

describe("PaymentService.refund", () => {
  it("refunds through the provider stored on the payment record", async () => {
    const sandbox = new FakePaymentProvider("sandbox");
    const stripe = new FakePaymentProvider("stripe");
    const seeded = stripe.seedCharge({
      orderId: "ord_1",
      amountCents: 1_999,
      currency: "INR",
      idempotencyKey: "order:ord_1:pay:v1",
    });

    const order = aPaidOrder({
      payment: {
        provider: "stripe",
        transactionId: seeded.transactionId,
        idempotencyKey: "order:ord_1:pay:v1",
      },
    });

    const { module, orders } = setup({
      providers: [sandbox, stripe],
      order,
      config: { enabledProviders: ["sandbox", "stripe"] },
    });

    const result = await module.payments.refund("ord_1");

    expect(stripe.refunds).toEqual([
      { transactionId: seeded.transactionId, amountCents: 1_999 },
    ]);
    expect(sandbox.refunds).toHaveLength(0);
    expect(result).toMatchObject({
      provider: "stripe",
      amountCents: 1_999,
      refundedCents: 1_999,
      refundableCents: 0,
    });

    expect((await orders.findById("ord_1"))?.status).toBe("refunded");
  });

  it("supports partial refunds until the payment is fully refunded", async () => {
    const sandbox = new FakePaymentProvider("sandbox");
    const seeded = sandbox.seedCharge({
      orderId: "ord_1",
      amountCents: 1_999,
      currency: "INR",
      idempotencyKey: "order:ord_1:pay:v1",
    });

    const { module, orders } = setup({
      providers: [sandbox],
      order: aPaidOrder({
        payment: { provider: "sandbox", transactionId: seeded.transactionId },
      }),
    });

    const first = await module.payments.refund("ord_1", 500);
    expect(first).toMatchObject({ refundedCents: 500, refundableCents: 1_499 });
    expect((await orders.findById("ord_1"))?.status).toBe("paid");

    const second = await module.payments.refund("ord_1");
    expect(second).toMatchObject({ refundedCents: 1_999, refundableCents: 0 });
    expect((await orders.findById("ord_1"))?.status).toBe("refunded");
  });

  it("rejects a refund larger than the refundable amount", async () => {
    const sandbox = new FakePaymentProvider("sandbox");
    const seeded = sandbox.seedCharge({
      orderId: "ord_1",
      amountCents: 1_999,
      currency: "INR",
      idempotencyKey: "order:ord_1:pay:v1",
    });

    const { module } = setup({
      providers: [sandbox],
      order: aPaidOrder({
        payment: { provider: "sandbox", transactionId: seeded.transactionId },
      }),
    });

    await expect(module.payments.refund("ord_1", 2_000)).rejects.toBeInstanceOf(
      RefundExceedsPaymentError,
    );
  });

  it("rejects a refund for an order without a successful payment", async () => {
    const { module } = setup();

    await expect(module.payments.refund("ord_1")).rejects.toBeInstanceOf(
      PaymentNotFoundError,
    );
  });
});

describe("PaymentService.getPayment", () => {
  it("returns the payment record", async () => {
    const { module } = setup({ order: aPaidOrder() });

    const payment = await module.payments.getPayment("ord_1");

    expect(payment.provider).toBe("sandbox");
    expect(payment.transactionId).toBe("tx_paid_1");
  });

  it("throws when the order has no payment", async () => {
    const { module } = setup();

    await expect(module.payments.getPayment("ord_1")).rejects.toBeInstanceOf(
      PaymentNotFoundError,
    );
  });
});

