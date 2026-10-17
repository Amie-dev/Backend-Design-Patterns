import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  PaymentDeclinedError,
  ProviderError,
} from "../../src/errors/payment.errors";
import { StripeProvider } from "../../src/providers/stripe-payment.provider";

type StripeStub = {
  createCalls: Array<{ input: Record<string, unknown>; options?: Record<string, unknown> }>;
  refundCalls: Array<{ input: Record<string, unknown>; options?: Record<string, unknown> }>;
  client: Stripe;
};

function stripeStub(options: {
  intentStatus?: string;
  refundStatus?: string;
  failWith?: unknown;
} = {}): StripeStub {
  const createCalls: StripeStub["createCalls"] = [];
  const refundCalls: StripeStub["refundCalls"] = [];

  const client = {
    paymentIntents: {
      create: async (
        input: Record<string, unknown>,
        requestOptions: Record<string, unknown>,
      ) => {
        createCalls.push({ input, options: requestOptions });
        if (options.failWith) throw options.failWith;
        return { id: "pi_123", status: options.intentStatus ?? "succeeded" };
      },
    },
    refunds: {
      create: async (
        input: Record<string, unknown>,
        requestOptions: Record<string, unknown>,
      ) => {
        refundCalls.push({ input, options: requestOptions });
        return { id: "re_123", status: options.refundStatus ?? "succeeded" };
      },
    },
  } as unknown as Stripe;

  return { createCalls, refundCalls, client };
}

const request = {
  orderId: "ord_1",
  amountCents: 1_999,
  currency: "INR",
  idempotencyKey: "order:ord_1:pay:v1",
};

describe("StripeProvider", () => {
  it("translates the request, options, and status", async () => {
    const stub = stripeStub({ intentStatus: "processing" });
    const provider = new StripeProvider(stub.client);

    const result = await provider.charge(request);

    expect(stub.createCalls[0]!.input).toMatchObject({
      amount: 1_999,
      currency: "inr",
      metadata: { orderId: "ord_1" },
    });
    expect(stub.createCalls[0]!.options).toEqual({
      idempotencyKey: "order:ord_1:pay:v1",
    });
    expect(result).toEqual({ transactionId: "pi_123", status: "pending" });
  });

  it("maps Stripe card errors to PaymentDeclinedError", async () => {
    const stub = stripeStub({
      failWith: Object.assign(new Error("declined"), {
        type: "StripeCardError",
        decline_code: "insufficient_funds",
      }),
    });
    const provider = new StripeProvider(stub.client);

    await expect(provider.charge(request)).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );
  });

  it("maps connection errors to retryable ProviderErrors", async () => {
    const stub = stripeStub({
      failWith: Object.assign(new Error("socket hang up"), {
        type: "StripeConnectionError",
      }),
    });
    const provider = new StripeProvider(stub.client);

    const error = await provider.charge(request).catch((caught) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).retryable).toBe(true);
    expect((error as ProviderError).httpStatus).toBe(503);
  });

  it("refunds with a deterministic idempotency key", async () => {
    const stub = stripeStub();
    const provider = new StripeProvider(stub.client);

    const result = await provider.refund("pi_123", 500);

    expect(stub.refundCalls[0]!.input).toEqual({
      payment_intent: "pi_123",
      amount: 500,
    });
    expect(stub.refundCalls[0]!.options).toEqual({
      idempotencyKey: "refund:pi_123:500",
    });
    expect(result).toEqual({ refundId: "re_123", amountCents: 500, status: "succeeded" });
  });

  it("rejects a failed refund as a terminal provider error", async () => {
    const stub = stripeStub({ refundStatus: "failed" });
    const provider = new StripeProvider(stub.client);

    await expect(provider.refund("pi_123", 500)).rejects.toMatchObject({
      retryable: false,
    });
  });
});
