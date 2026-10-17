import { createHash } from "node:crypto";
import {
  PaymentDeclinedError,
  ProviderError,
} from "../errors/payment.errors";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "./payment-provider";

export type SandboxOptions = {
  /** Simulated network latency. Set to 0 in tests. */
  latencyMs?: number;
  /** Makes transaction ids deterministic per environment. */
  seed?: number;
};

type ChargeRecord = {
  transactionId: string;
  amountCents: number;
  currency: string;
};

/**
 * A deterministic, network-free provider used by the demo and by tests.
 *
 * It behaves like a real vendor in the ways that matter for the pattern:
 * - charges are idempotent per `idempotencyKey`
 * - refunds are bounded by the captured amount
 * - failures are typed domain errors
 *
 * Trigger keywords in the order id make failure paths reproducible:
 *   ...decline...  -> PaymentDeclinedError (402)
 *   ...flaky...    -> one retryable failure, then success
 *   ...outage...   -> retryable failure on every attempt (503)
 *   ...terminal... -> non-retryable failure (502)
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";

  private readonly latencyMs: number;
  private readonly seed: number;
  private readonly chargesByIdempotencyKey = new Map<string, PaymentResult>();
  private readonly chargesByTransaction = new Map<string, ChargeRecord>();
  private readonly refundedByTransaction = new Map<string, number>();
  private readonly attemptsByOrder = new Map<string, number>();

  constructor(options: SandboxOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.seed = options.seed ?? 1;
  }

  async charge(input: PaymentRequest): Promise<PaymentResult> {
    await this.delay();
    this.assertAmount(input.amountCents, "charge");

    const existing = this.chargesByIdempotencyKey.get(input.idempotencyKey);
    if (existing) return existing;

    if (input.orderId.includes("decline")) {
      throw new PaymentDeclinedError(this.name, "insufficient_funds");
    }

    const attempt = (this.attemptsByOrder.get(input.orderId) ?? 0) + 1;
    this.attemptsByOrder.set(input.orderId, attempt);

    if (input.orderId.includes("outage")) {
      throw new ProviderError(this.name, "charge", true);
    }
    if (input.orderId.includes("terminal")) {
      throw new ProviderError(this.name, "charge", false);
    }
    if (input.orderId.includes("flaky") && attempt === 1) {
      throw new ProviderError(this.name, "charge", true);
    }

    return this.rememberCharge(input);
  }

  async refund(transactionId: string, amountCents: number): Promise<RefundResult> {
    await this.delay();
    this.assertAmount(amountCents, "refund");

    const charge = this.chargesByTransaction.get(transactionId);
    if (!charge) {
      throw new ProviderError(this.name, "refund", false);
    }

    const refunded = this.refundedByTransaction.get(transactionId) ?? 0;
    if (amountCents > charge.amountCents - refunded) {
      throw new ProviderError(this.name, "refund", false);
    }

    const result: RefundResult = {
      refundId: `rf_sbx_${this.digest(`${transactionId}:${refunded}:${amountCents}`)}`,
      amountCents,
      status: "succeeded",
    };

    this.refundedByTransaction.set(transactionId, refunded + amountCents);

    return result;
  }

  /**
   * Demo/test helper: records a successful charge without simulating failures,
   * so a seeded "paid" order can be refunded through the normal adapter.
   */
  seedCharge(input: PaymentRequest): PaymentResult {
    this.assertAmount(input.amountCents, "charge");
    const existing = this.chargesByIdempotencyKey.get(input.idempotencyKey);
    return existing ?? this.rememberCharge(input);
  }

  private rememberCharge(input: PaymentRequest): PaymentResult {
    const result: PaymentResult = {
      transactionId: `tx_sbx_${this.digest(input.idempotencyKey)}`,
      status: "succeeded",
    };

    this.chargesByIdempotencyKey.set(input.idempotencyKey, result);
    this.chargesByTransaction.set(result.transactionId, {
      transactionId: result.transactionId,
      amountCents: input.amountCents,
      currency: input.currency,
    });

    return result;
  }

  private digest(value: string): string {
    return createHash("sha256")
      .update(`${this.seed}:${value}`)
      .digest("hex")
      .slice(0, 14);
  }

  private assertAmount(amountCents: number, operation: "charge" | "refund"): void {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new ProviderError(this.name, operation, false);
    }
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }
}
