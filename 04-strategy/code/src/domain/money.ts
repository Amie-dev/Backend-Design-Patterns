import { InvalidDiscountError } from "../errors/discount.errors";

export type Currency = "INR" | "USD" | "EUR";

/**
 * All monetary values are integers in the smallest currency unit.
 * This guard is the first line of defence against `NaN`, floats, and
 * negative values entering a pricing path.
 */
export function assertAmount(amount: number, label = "amount"): number {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new InvalidDiscountError(
      `${label} must be a non-negative integer in minor units`,
    );
  }
  return amount;
}

/**
 * Percentage discounts round half-up. This is a business decision, not a
 * language default — document it and test the boundary.
 */
export function percentage(amount: number, rate: number): number {
  assertAmount(amount);

  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new InvalidDiscountError("rate must be between 0 and 1");
  }

  return Math.round(amount * rate);
}

/** Enforces the contract invariant: 0 <= discount <= amount. */
export function clampDiscount(discount: number, amount: number): number {
  assertAmount(amount);

  if (!Number.isInteger(discount) || discount < 0) {
    throw new InvalidDiscountError(
      "discount must be a non-negative integer in minor units",
    );
  }

  return Math.min(discount, amount);
}
