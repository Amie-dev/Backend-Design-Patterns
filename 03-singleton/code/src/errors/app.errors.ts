/**
 * Domain errors carry their HTTP mapping so controllers and the error
 * middleware never inspect infrastructure internals.
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

/** Invalid or missing configuration. Always thrown before `listen()`. */
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

export class OrderNotPendingError extends AppError {
  constructor(
    readonly orderId: string,
    readonly status: string,
  ) {
    super(
      `Order ${orderId} is ${status} and cannot be cancelled`,
      "order_not_pending",
      409,
      { orderId, status },
    );
  }
}

export class InvalidOrderError extends AppError {
  constructor(message: string) {
    super(message, "invalid_order", 400);
  }
}

/** The pool queue is full for too long. Callers can retry with backoff. */
export class PoolTimeoutError extends AppError {
  constructor(
    readonly poolId: string,
    readonly timeoutMs: number,
  ) {
    super(
      `Database pool ${poolId} could not hand out a connection within ${timeoutMs}ms`,
      "db_pool_timeout",
      503,
      { poolId, timeoutMs, retryable: true },
    );
  }
}

export class PoolClosedError extends AppError {
  constructor(readonly poolId: string) {
    super(`Database pool ${poolId} is closed`, "db_pool_closed", 503, {
      poolId,
    });
  }
}
