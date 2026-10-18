import type { Cart } from "../../src/domain/cart";

/** Two units of ₹250.00 => subtotal 50 000 minor units. */
export function aCart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: "cart_test",
    userId: "usr_guest",
    currency: "INR",
    lines: [{ productId: "prod_1", quantity: 2, unitAmount: 25_000 }],
    ...overrides,
  };
}
