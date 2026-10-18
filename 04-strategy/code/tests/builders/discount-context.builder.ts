import type { DiscountContext } from "../../src/strategies/discount-strategy";

export function aDiscountContext(
  overrides: Partial<DiscountContext> = {},
): DiscountContext {
  return {
    amount: 10_000,
    currency: "INR",
    customerType: "guest",
    productIds: ["prod_1"],
    now: new Date("2026-02-01T10:00:00Z"),
    ...overrides,
  };
}
