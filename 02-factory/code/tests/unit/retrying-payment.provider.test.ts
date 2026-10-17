import { describe, expect, it } from "vitest";
import { PaymentDeclinedError, ProviderError } from "../../src/errors/payment.errors";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "../../src/providers/payment-provider";
import { RetryingPaymentProvider } from "../../src/providers/retrying-payment.provider";

const request: PaymentRequest = {
  orderId: "ord_retry",
  amountCents: 1_000,
  currency: "INR",
  idempotencyKey: "order:ord_retry:pay:v1",
};

function flakyProvider(failures: number) {
  let attempts = 0;

  const inner: PaymentProvider = {
    name: "flaky",
    async charge(): Promise<PaymentResult> {
      attempts += 1;
      if (attempts <= failures) {
        throw new ProviderError("flaky", "charge", true);
      }
      return { transactionId: "tx_retry", status: "succeeded" };
    },
    async refund(): Promise<RefundResult> {
      return { refundId: "rf_retry", amountCents: 1, status: "succeeded" };
    },
  };

  return { inner, attempts: () => attempts };
}

describe("RetryingPaymentProvider", () => {
  it("retries retryable failures with exponential backoff and the same key", async () => {
    const { inner, attempts } = flakyProvider(2);
    const delays: number[] = [];
    const provider = new RetryingPaymentProvider(inner, {
      maxRetries: 2,
      baseDelayMs: 10,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    const result = await provider.charge(request);

    expect(result.transactionId).toBe("tx_retry");
    expect(attempts()).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("gives up after maxRetries", async () => {
    const { inner, attempts } = flakyProvider(5);
    const provider = new RetryingPaymentProvider(inner, {
      maxRetries: 1,
      baseDelayMs: 0,
      sleep: async () => {},
    });

    await expect(provider.charge(request)).rejects.toBeInstanceOf(ProviderError);
    expect(attempts()).toBe(2);
  });

  it("does not retry terminal provider errors", async () => {
    const terminal: PaymentProvider = {
      name: "terminal",
      async charge() {
        throw new ProviderError("terminal", "charge", false);
      },
      async refund() {
        return { refundId: "rf", amountCents: 1, status: "succeeded" };
      },
    };

    const provider = new RetryingPaymentProvider(terminal, {
      maxRetries: 3,
      baseDelayMs: 0,
      sleep: async () => {},
    });

    await expect(provider.charge(request)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("does not retry declines", async () => {
    let attempts = 0;
    const declining: PaymentProvider = {
      name: "declining",
      async charge() {
        attempts += 1;
        throw new PaymentDeclinedError("declining", "insufficient_funds");
      },
      async refund() {
        return { refundId: "rf", amountCents: 1, status: "succeeded" };
      },
    };

    const provider = new RetryingPaymentProvider(declining, {
      maxRetries: 3,
      baseDelayMs: 0,
      sleep: async () => {},
    });

    await expect(provider.charge(request)).rejects.toBeInstanceOf(
      PaymentDeclinedError,
    );
    expect(attempts).toBe(1);
  });

  it("delegates the name and refunds to the wrapped provider", async () => {
    const { inner } = flakyProvider(0);
    const provider = new RetryingPaymentProvider(inner);

    expect(provider.name).toBe("flaky");
    await expect(provider.refund("tx_1", 100)).resolves.toMatchObject({
      refundId: "rf_retry",
    });
  });
});
