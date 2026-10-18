import { describe, expect, it } from "vitest";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";
import { aDiscountContext } from "../builders/discount-context.builder";

describe("StudentDiscount", () => {
  const strategy = new StudentDiscount();

  it.each([
    [0, 0],
    [1, 0], // 0.1 rounds down
    [5, 1], // 0.5 rounds up
    [10_000, 1_000],
    [12_345, 1_235], // 1 234.5 -> 1 235
  ])("amount %i -> discount %i", (amount, expected) => {
    expect(
      strategy.calculate(aDiscountContext({ amount, customerType: "student" })),
    ).toBe(expected);
  });
});
