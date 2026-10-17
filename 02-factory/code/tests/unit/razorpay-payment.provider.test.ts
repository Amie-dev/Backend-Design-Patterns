import { describe, expect, it } from "vitest";
import {
  PaymentDeclinedError,
  ProviderError,
} from "../../src/errors/payment.errors";
import {
  RazorpayProvider,
  type RazorpayClient,
} from "../../src/providers/razorpay-payment.provider";

function razorpayStub(options: {
  orderStatus?: string;
  refundStatus?: string;
  failWith?: unknown;
} = {}) {
  const orderCalls: Array<Record<string, unknown>> = [];
  const refundCalls: Array<{ paymentId: string; input: Record<string, unknown> }> = [];

  const client: RazorpayClient = {
    orders: {
      create: async (input) => {
        orderCalls.push(input);
        if (options.failWith) throw options.failWith;
        return { id: "order_123", status: options.orderStatus ?? "created" };
      },
    },
    payments: {
      refund: async (paymentId, input) => {
        refundCalls.push({ paymentId, input });
        return { id: "rf_123", status: options.refundStatus ?? "processed" };
      },
    },
  };

  return { client, orderCalls, refundCalls };
}

const request = {
  orderId: "ord_1",
  amountCents: 1_999,
  currency: "INR",
  idempotencyKey: "order:ord_1:pay:v1",
};

describe("RazorpayProvider", () => {
  it("creates an order and maps the Razorpay status", async () => {
    const stub = razorpayStub({ orderStatus: "created" });
    const provider = new RazorpayProvider(stub.client);

    const result = await provider.charge(request);

    expect(stub.orderCalls[0]).toMatchObject({
      amount: 1_999,
      currency: "INR",
      receipt: "ord_1",
      notes: { orderId: "ord_1", idempotencyKey: "order:ord_1:pay:v1" },
    });
    expect(result).toEqual({ transactionId: "order_123", status: "pending" });
  });

  it("maps a paid order to succeeded", async () => {
    const stub = razorpayStub({ orderStatus: "paid" });
    const provider = new RazorpayProvider(stub.client);

    await expect(provider.charge(request)).resolves.toEqual({
      transactionId: "order_123",
      status: "succeeded",
    });
  });

  it("maps payment_failed to PaymentDeclinedError", async () => {
    const stub = razorpayStub({
      failWith: {
        statusCode: 400,
        error: { reason: "payment_failed", code: "BAD_REQUEST_ERROR" },
      },
    });
    const provider = new RazorpayProvider(stub.client);

    await expect(provider.charge(request)).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );
  });

  it("treats 5xx failures as retryable and 4xx failures as terminal", async () => {
    const serverError = razorpayStub({ failWith: { statusCode: 502 } });
    const clientError = razorpayStub({ failWith: { statusCode: 400 } });

    const retryable = await new RazorpayProvider(serverError.client)
      .charge(request)
      .catch((error) => error);
    const terminal = await new RazorpayProvider(clientError.client)
      .charge(request)
      .catch((error) => error);

    expect(retryable).toBeInstanceOf(ProviderError);
    expect((retryable as ProviderError).retryable).toBe(true);
    expect((terminal as ProviderError).retryable).toBe(false);
  });

  it("refunds through the payments API and maps the status", async () => {
    const stub = razorpayStub({ refundStatus: "processed" });
    const provider = new RazorpayProvider(stub.client);

    const result = await provider.refund("pay_123", 500);

    expect(stub.refundCalls[0]!.paymentId).toBe("pay_123");
    expect(stub.refundCalls[0]!.input).toEqual({
      amount: 500,
      notes: { idempotencyKey: "refund:pay_123:500" },
    });
    expect(result).toEqual({ refundId: "rf_123", amountCents: 500, status: "succeeded" });
  });

  it("reports a pending refund as pending", async () => {
    const stub = razorpayStub({ refundStatus: "pending" });
    const provider = new RazorpayProvider(stub.client);

    await expect(provider.refund("pay_123", 500)).resolves.toMatchObject({
      status: "pending",
    });
  });
});
