/**
 * Domain errors carry their HTTP mapping with them so controllers and the
 * error middleware never inspect vendor payloads.
 */

export type AppErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly httpStatus: number,
    readonly details?: AppErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, "configuration_error", 500);
  }
}

export class OrderNotFoundError extends AppError {
  constructor(readonly orderId: string) {
    super(`Order ${orderId} not found`, "order_not_found", 404, { orderId });
  }
}

export class OrderNotPayableError extends AppError {
  constructor(
    readonly orderId: string,
    readonly status: string,
    readonly transactionId?: string,
  ) {
    super(
      `Order ${orderId} is ${status} and cannot be charged`,
      "order_not_payable",
      409,
      { orderId, status, transactionId },
    );
  }
}

export class PaymentNotFoundError extends AppError {
  constructor(readonly orderId: string) {
    super(`Order ${orderId} has no payment`, "payment_not_found", 404, { orderId });
  }
}

export class RefundExceedsPaymentError extends AppError {
  constructor(
    readonly orderId: string,
    readonly requestedCents: number,
    readonly refundableCents: number,
  ) {
    super(
      `Refund of ${requestedCents} exceeds refundable amount ${refundableCents}`,
      "refund_exceeds_payment",
      409,
      { orderId, requestedCents, refundableCents },
    );
  }
}

/**
 * Thrown when a caller asks for a provider that is not registered/enabled.
 * This is a client error (422), not a server error.
 */
export class UnsupportedProviderError extends AppError {
  readonly supported: readonly string[];

  constructor(
    readonly requested: string,
    supported: readonly string[],
  ) {
    super(
      `Unsupported payment provider: ${requested}`,
      "unsupported_provider",
      422,
      { requested, supported },
    );
    this.supported = supported;
  }
}

export class PaymentDeclinedError extends AppError {
  constructor(
    readonly provider: string,
    readonly declineCode: string,
  ) {
    super(
      `Payment declined by ${provider} (${declineCode})`,
      "payment_declined",
      402,
      { provider, declineCode },
    );
  }
}

/**
 * A transport/vendor failure. Retryable failures become 503 + Retry-After;
 * terminal failures become 502.
 */
export class ProviderError extends AppError {
  constructor(
    readonly provider: string,
    readonly operation: "charge" | "refund",
    readonly retryable: boolean,
    readonly reason?: unknown,
  ) {
    super(
      `${provider} failed during ${operation}`,
      "provider_error",
      retryable ? 503 : 502,
      { provider, operation, retryable },
      reason === undefined ? undefined : { cause: reason },
    );
  }
}
