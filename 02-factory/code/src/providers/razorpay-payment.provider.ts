import {
  PaymentDeclinedError,
  ProviderError,
} from "../errors/payment.errors";
import { fromRazorpayStatus } from "../mappers/payment.mapper";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "./payment-provider";

/**
 * Narrow structural type for the Razorpay SDK. Depending on the shape we use
 * (instead of the vendor's full surface) keeps the adapter easy to fake.
 */
export type RazorpayClient = {
  orders: {
    create(input: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string>;
    }): Promise<{ id: string; status: string }>;
  };
  payments: {
    refund(
      paymentId: string,
      input: { amount: number; notes?: Record<string, string> },
    ): Promise<{ id: string; status: string }>;
  };
};

type RazorpayErrorLike = {
  statusCode?: number;
  error?: {
    code?: string;
    description?: string;
    reason?: string;
  };
};

/**
 * Adapter: Razorpay SDK <-> domain contract.
 *
 * Razorpay charges are two-step: create an order, then the client confirms and
 * the payment is captured. The adapter therefore returns `pending` for a new
 * order; a webhook (out of scope for this demo) moves the order to paid.
 */
export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";

  constructor(private readonly client: RazorpayClient) {}

  async charge(input: PaymentRequest): Promise<PaymentResult> {
    try {
      const order = await this.client.orders.create({
        amount: input.amountCents,
        currency: input.currency,
        receipt: input.orderId,
        notes: {
          orderId: input.orderId,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return {
        transactionId: order.id,
        status: fromRazorpayStatus(order.status),
      };
    } catch (error) {
      throw this.translate(error, "charge");
    }
  }

  async refund(transactionId: string, amountCents: number): Promise<RefundResult> {
    try {
      const refund = await this.client.payments.refund(transactionId, {
        amount: amountCents,
        notes: { idempotencyKey: `refund:${transactionId}:${amountCents}` },
      });

      return {
        refundId: refund.id,
        amountCents,
        status: refund.status === "processed" ? "succeeded" : "pending",
      };
    } catch (error) {
      throw this.translate(error, "refund");
    }
  }

  private translate(error: unknown, operation: "charge" | "refund"): Error {
    if (error instanceof ProviderError) return error;

    const razorpayError = error as RazorpayErrorLike;
    const statusCode = razorpayError.statusCode ?? 0;
    const reason = razorpayError.error?.reason ?? "";
    const description = (razorpayError.error?.description ?? "").toLowerCase();

    if (reason === "payment_failed" || description.includes("declined")) {
      return new PaymentDeclinedError(
        this.name,
        razorpayError.error?.code ?? "payment_failed",
      );
    }

    const retryable = statusCode === 429 || statusCode >= 500;
    return new ProviderError(this.name, operation, retryable, error);
  }
}
