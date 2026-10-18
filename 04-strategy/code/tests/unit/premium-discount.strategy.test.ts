import { describe, expect, it } from "vitest";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { aDiscountContext } from "../builders/discount-context.builder";

describe("PremiumDiscount", () => {
  const strategy = new PremiumDiscount();

  it("takes 15% of the subtotal", () => {
    expect(strategy.calculate(aDiscountContext())).toBe(1_500);
  });

  it("rounds half-up at the minor-unit boundary", () => {
    // 9 999 * 0.15 = 1 499.85 -> 1 500
    expect(strategy.calculate(aDiscountContext({ amount: 9_999 }))).toBe(1_500);
  });

  it("returns zero for an empty cart", () => {
    expect(strategy.calculate(aDiscountContext({ amount: 0 }))).toBe(0);
  });

  it("is deterministic for the same context", () => {
    expect(strategy.calculate(aDiscountContext())).toBe(
      strategy.calculate(aDiscountContext()),
    );
  });
});
