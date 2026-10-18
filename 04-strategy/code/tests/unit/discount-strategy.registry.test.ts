import { describe, expect, it } from "vitest";
import type { DiscountPolicy } from "../../src/domain/discount-policy";
import {
  DiscountStrategyRegistry,
} from "../../src/services/discount-strategy.registry";
import type { DiscountKey } from "../../src/strategies/discount-strategy";
import { NoDiscount } from "../../src/strategies/no-discount.strategy";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";

const registry = new DiscountStrategyRegistry(
  new PremiumDiscount(),
  new StudentDiscount(),
  new NoDiscount(),
);

const cases: Array<[DiscountPolicy, DiscountKey]> = [
  [{ kind: "premium" }, "premium"],
  [{ kind: "student" }, "student"],
  [
    { kind: "festival", fixedAmount: 10_000, excludedProductIds: ["prod_sale"] },
    "festival",
  ],
  [{ kind: "none" }, "none"],
];

describe("DiscountStrategyRegistry", () => {
  it.each(cases)("resolves %j to %s", (policy, expectedKey) => {
    expect(registry.resolve(policy).key).toBe(expectedKey);
  });

  it("throws for an unhandled policy kind", () => {
    expect(() =>
      registry.resolve({ kind: "vip" } as unknown as DiscountPolicy),
    ).toThrow(/No strategy registered/);
  });
});
