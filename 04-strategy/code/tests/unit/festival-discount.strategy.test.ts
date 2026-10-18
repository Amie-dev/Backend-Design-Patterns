import { describe, expect, it } from "vitest";
import { FestivalDiscount } from "../../src/strategies/festival-discount.strategy";
import { aDiscountContext } from "../builders/discount-context.builder";

const strategy = new FestivalDiscount(10_000, new Set(["prod_sale"]));

describe("FestivalDiscount", () => {
  it("applies the fixed amount", () => {
    expect(
      strategy.calculate(
        aDiscountContext({ amount: 50_000, productIds: ["prod_1"] }),
      ),
    ).toBe(10_000);
  });

  it("never discounts more than the cart", () => {
    expect(
      strategy.calculate(
        aDiscountContext({ amount: 7_500, productIds: ["prod_1"] }),
      ),
    ).toBe(7_500);
  });

  it("returns zero when any product is excluded", () => {
    expect(
      strategy.calculate(
        aDiscountContext({
          amount: 50_000,
          productIds: ["prod_1", "prod_sale"],
        }),
      ),
    ).toBe(0);
  });

  it("applies when the cart is exactly the fixed amount", () => {
    expect(
      strategy.calculate(
        aDiscountContext({ amount: 10_000, productIds: ["prod_1"] }),
      ),
    ).toBe(10_000);
  });
});
