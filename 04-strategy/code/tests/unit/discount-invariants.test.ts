import { describe, expect, it } from "vitest";
import type { DiscountStrategy } from "../../src/strategies/discount-strategy";
import { FestivalDiscount } from "../../src/strategies/festival-discount.strategy";
import { NoDiscount } from "../../src/strategies/no-discount.strategy";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";
import { aDiscountContext } from "../builders/discount-context.builder";

const strategies: DiscountStrategy[] = [
  new PremiumDiscount(),
  new StudentDiscount(),
  new FestivalDiscount(10_000, new Set(["prod_sale"])),
  new NoDiscount(),
];

const cases: Array<[string, DiscountStrategy]> = strategies.map((strategy) => [
  strategy.key,
  strategy,
]);

describe("discount invariants", () => {
  it.each(cases)(
    "%s never returns a negative, fractional, or over-cart discount",
    (_key, strategy) => {
      for (let amount = 0; amount <= 200_000; amount += 137) {
        for (const productIds of [[], ["prod_1"], ["prod_sale"]]) {
          const discount = strategy.calculate(
            aDiscountContext({ amount, productIds }),
          );

          expect(Number.isInteger(discount)).toBe(true);
          expect(discount).toBeGreaterThanOrEqual(0);
          expect(discount).toBeLessThanOrEqual(amount);
        }
      }
    },
  );
});
