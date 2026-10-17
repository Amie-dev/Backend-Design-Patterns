import { ProviderError } from "../../src/errors/payment.errors";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "../../src/providers/payment-provider";

/**
 * Configurable test double. It records every call and enforces the same
 * refund bounds as a real provider, so it can run the shared contract suite.
 */
export class FakePaymentProvider implements PaymentProvider {
  readonly charges: PaymentRequest[] = [];
  readonly refunds: Array<{ transactionId: string; amountCents: number }> = [];

  private readonly resultsByIdempotencyKey = new Map<string, PaymentResult>();
  private readonly capturedByTransaction = new Map<string, number>();
  private readonly refundedByTransaction = new Map<string, number>();
  private result: PaymentResult | undefined;
  private error: Error | undefined;
  private nextId = 1;

  constructor(readonly name: string) {}

  willReturn(result: PaymentResult): this {
    this.result = result;
    return this;
  }

  willFailWith(error: Error): this {
    this.error = error;
    return this;
  }

  /** Seeds a captured transaction so a paid order can be refunded in tests. */
  seedCharge(input: PaymentRequest): PaymentResult {
    const result: PaymentResult = {
      transactionId: `tx_${this.name}_seed_${this.nextId++}`,
      status: "succeeded",
    };

    this.capturedByTransaction.set(result.transactionId, input.amountCents);
    return result;
  }

  async charge(input: PaymentRequest): Promise<PaymentResult> {
    this.charges.push(input);
    if (this.error) throw this.error;

    const existing = this.resultsByIdempotencyKey.get(input.idempotencyKey);
    if (existing) return existing;

    const result: PaymentResult = this.result ?? {
      transactionId: `tx_${this.name}_${this.nextId++}`,
      status: "succeeded",
    };

    this.resultsByIdempotencyKey.set(input.idempotencyKey, result);
    if (result.status === "succeeded") {
      this.capturedByTransaction.set(result.transactionId, input.amountCents);
    }

    return result;
  }

  async refund(transactionId: string, amountCents: number): Promise<RefundResult> {
    this.refunds.push({ transactionId, amountCents });

    const captured = this.capturedByTransaction.get(transactionId) ?? 0;
    const refunded = this.refundedByTransaction.get(transactionId) ?? 0;

    if (amountCents > captured - refunded) {
      throw new ProviderError(this.name, "refund", false);
    }

    this.refundedByTransaction.set(transactionId, refunded + amountCents);

    return {
      refundId: `rf_${this.name}_${this.refunds.length}`,
      amountCents,
      status: "succeeded",
    };
  }
}
