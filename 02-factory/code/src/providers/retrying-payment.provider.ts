import { ProviderError } from "../errors/payment.errors";
import { createNoopLogger, type Logger } from "../lib/logger";
import type {
  PaymentProvider,
  PaymentRequest,
  PaymentResult,
  RefundResult,
} from "./payment-provider";

export type RetryOptions = {
  /** Additional attempts after the first one. 0 disables retries. */
  maxRetries?: number;
  baseDelayMs?: number;
  logger?: Logger;
  /** Injectable for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Decorator: adds bounded retries for retryable provider failures.
 *
 * It implements the same `PaymentProvider` contract, so it composes with the
 * factory without the service knowing it exists. Only charges are retried;
 * retries reuse the same idempotency key, which is what makes them safe.
 */
export class RetryingPaymentProvider implements PaymentProvider {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly logger: Logger;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly inner: PaymentProvider,
    options: RetryOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 50;
    this.logger = options.logger ?? createNoopLogger();
    this.sleep =
      options.sleep ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  get name(): string {
    return this.inner.name;
  }

  async charge(input: PaymentRequest): Promise<PaymentResult> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.inner.charge(input);
      } catch (error) {
        const retryable =
          error instanceof ProviderError &&
          error.retryable &&
          attempt < this.maxRetries;

        if (!retryable) throw error;

        const delayMs = this.baseDelayMs * 2 ** attempt;
        this.logger.warn("retrying payment charge", {
          provider: this.inner.name,
          orderId: input.orderId,
          attempt: attempt + 1,
          delayMs,
        });
        await this.sleep(delayMs);
      }
    }
  }

  refund(transactionId: string, amountCents: number): Promise<RefundResult> {
    return this.inner.refund(transactionId, amountCents);
  }
}
