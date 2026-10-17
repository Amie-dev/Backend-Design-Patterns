import Stripe from "stripe";
import {
  PaymentDeclinedError,
  ProviderError,
} from "../errors/payment.errors";
import {
  fromStripeRefundStatus,
  fromStripeStatus,
} from "../mappers/payment.mapper";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "./payment-provider";

type StripeErrorLike = {
  type?: string;
  code?: string;
  decline_code?: string;
  statusCode?: number;
  message?: string;
};

/**
 * Adapter: Stripe SDK <-> domain contract.
 *
 * Everything Stripe-specific lives here: amount/currency casing, idempotency
 * options, status vocabulary, and error translation.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";

  constructor(private readonly client: Stripe) {}

  async charge(input: PaymentRequest): Promise<PaymentResult> {
    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          description: `Order ${input.orderId}`,
          metadata: { orderId: input.orderId },
        },
        { idempotencyKey: input.idempotencyKey },
      );

      return {
        transactionId: intent.id,
        status: fromStripeStatus(intent.status),
      };
    } catch (error) {
      throw this.translate(error, "charge");
    }
  }

  async refund(transactionId: string, amountCents: number): Promise<RefundResult> {
    try {
      const refund = await this.client.refunds.create(
        { payment_intent: transactionId, amount: amountCents },
        { idempotencyKey: `refund:${transactionId}:${amountCents}` },
      );

      const status = fromStripeRefundStatus(refund.status ?? "pending");
      if (status === "failed") {
        throw new ProviderError(this.name, "refund", false);
      }

      return { refundId: refund.id, amountCents, status };
    } catch (error) {
      throw this.translate(error, "refund");
    }
  }

  private translate(error: unknown, operation: "charge" | "refund"): Error {
    if (error instanceof ProviderError) return error;

    const stripeError = error as StripeErrorLike;
    const statusCode = stripeError.statusCode ?? 0;

    if (stripeError.type === "StripeCardError") {
      return new PaymentDeclinedError(
        this.name,
        stripeError.decline_code ?? stripeError.code ?? "card_declined",
      );
    }

    const retryable =
      stripeError.type === "StripeConnectionError" ||
      stripeError.type === "StripeAPIError" ||
      stripeError.type === "StripeRateLimitError" ||
      statusCode === 429 ||
      statusCode >= 500;

    return new ProviderError(this.name, operation, retryable, error);
  }
}
