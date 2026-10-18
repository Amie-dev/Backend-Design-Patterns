import { clampDiscount, percentage } from "../domain/money";
import type { DiscountContext, DiscountStrategy } from "./discount-strategy";

export class PremiumDiscount implements DiscountStrategy {
  readonly key = "premium" as const;

  calculate({ amount }: DiscountContext): number {
    return clampDiscount(percentage(amount, 0.15), amount);
  }
}
