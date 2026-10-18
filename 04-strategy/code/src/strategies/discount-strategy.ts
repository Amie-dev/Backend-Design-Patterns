import type { CustomerType } from "../domain/customer";
import type { Currency } from "../domain/money";

export const DISCOUNT_KEYS = [
  "none",
  "premium",
  "student",
  "festival",
] as const;

export type DiscountKey = (typeof DISCOUNT_KEYS)[number];

/**
 * Everything a rule needs, expressed as data. Strategies never read the
 * database, the request, or the clock.
 */
export type DiscountContext = {
  /** Cart subtotal in minor units. */
  readonly amount: number;
  readonly currency: Currency;
  readonly customerType: CustomerType;
  readonly productIds: readonly string[];
  /** Injected so every rule is deterministic and testable. */
  readonly now: Date;
};

export interface DiscountStrategy {
  /** Stable identifier used for selection, logs, and metrics. */
  readonly key: DiscountKey;
  /** Discount in minor units; must satisfy 0 <= result <= context.amount. */
  calculate(context: DiscountContext): number;
}
