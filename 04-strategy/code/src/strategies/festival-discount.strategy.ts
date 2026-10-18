import { assertAmount, clampDiscount } from "../domain/money";
import type { DiscountContext, DiscountStrategy } from "./discount-strategy";

/**
 * A fixed-amount campaign. Its parameters come from the policy, so the same
 * class serves every campaign without reading configuration.
 */
export class FestivalDiscount implements DiscountStrategy {
  readonly key = "festival" as const;

  constructor(
    private readonly fixedAmount: number,
    private readonly excludedProductIds: ReadonlySet<string>,
  ) {
    assertAmount(fixedAmount, "fixedAmount");
  }

  calculate({ amount, productIds }: DiscountContext): number {
    const cartHasExcludedProduct = productIds.some((id) =>
      this.excludedProductIds.has(id),
    );

    if (cartHasExcludedProduct) return 0;

    return clampDiscount(this.fixedAmount, amount);
  }
}
