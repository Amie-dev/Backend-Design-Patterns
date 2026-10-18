import type { DiscountPolicy } from "../domain/discount-policy";
import { UnknownStrategyError } from "../errors/discount.errors";
import type { DiscountStrategy } from "../strategies/discount-strategy";
import { FestivalDiscount } from "../strategies/festival-discount.strategy";

function assertNever(value: never): never {
  const key = (value as { kind?: string }).kind ?? "unknown";
  throw new UnknownStrategyError(key);
}

/**
 * The selector. It maps a resolved policy to an implementation and contains
 * no rule arithmetic. `assertNever` turns a forgotten case into a loud
 * failure instead of a silent zero.
 */
export class DiscountStrategyRegistry {
  constructor(
    private readonly premium: DiscountStrategy,
    private readonly student: DiscountStrategy,
    private readonly none: DiscountStrategy,
  ) {}

  resolve(policy: DiscountPolicy): DiscountStrategy {
    switch (policy.kind) {
      case "premium":
        return this.premium;
      case "student":
        return this.student;
      case "festival":
        return new FestivalDiscount(
          policy.fixedAmount,
          new Set(policy.excludedProductIds),
        );
      case "none":
        return this.none;
      default:
        return assertNever(policy);
    }
  }
}
