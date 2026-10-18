/**
 * Domain errors.
 *
 * Every error carries an HTTP status and a stable machine code, so the
 * transport layer maps them in one place instead of guessing from messages.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A rule produced a value outside the contract (negative, fractional, > cart). */
export class InvalidDiscountError extends DomainError {
  constructor(message: string) {
    super("invalid_discount", message, 422);
  }
}

/** The authenticated user has no customer profile. */
export class UnknownCustomerError extends DomainError {
  constructor(userId: string) {
    super("customer_not_found", `No customer profile for ${userId}`, 404);
  }
}

/** A policy was resolved that the registry does not implement. This is a bug. */
export class UnknownStrategyError extends DomainError {
  constructor(key: string) {
    super("pricing_unavailable", `No strategy registered for "${key}"`, 500);
  }
}

/** The cart is structurally invalid (empty, bad quantity, unavailable product). */
export class InvalidCartError extends DomainError {
  constructor(message: string) {
    super("invalid_cart", message, 422);
  }
}

/** The catalog did not return one or more product ids. */
export class UnknownProductError extends DomainError {
  constructor(productIds: string) {
    super("product_not_found", `Unknown products: ${productIds}`, 404);
  }
}

/** A cart mixed products priced in different currencies. */
export class CurrencyMismatchError extends DomainError {
  constructor() {
    super("currency_mismatch", "All cart items must use the same currency", 422);
  }
}
