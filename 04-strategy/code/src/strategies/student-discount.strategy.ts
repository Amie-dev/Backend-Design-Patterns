import { clampDiscount, percentage } from "../domain/money";
import type { DiscountContext, DiscountStrategy } from "./discount-strategy";

export class StudentDiscount implements DiscountStrategy {
  readonly key = "student" as const;

  calculate({ amount }: DiscountContext): number {
    return clampDiscount(percentage(amount, 0.1), amount);
  }
}
