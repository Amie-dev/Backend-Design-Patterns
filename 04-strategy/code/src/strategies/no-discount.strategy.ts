import type { DiscountContext, DiscountStrategy } from "./discount-strategy";

/**
 * Explicit null object. Returning a strategy instead of `undefined` keeps the
 * checkout path free of conditional chaining.
 */
export class NoDiscount implements DiscountStrategy {
  readonly key = "none" as const;

  calculate(_context: DiscountContext): number {
    return 0;
  }
}
