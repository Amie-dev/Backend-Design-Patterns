import type { Currency } from "./money";

export type CartLine = {
  readonly productId: string;
  readonly quantity: number;
  /** Minor units, loaded from the catalog — never sent by the client. */
  readonly unitAmount: number;
};

export type Cart = {
  readonly id: string;
  readonly userId: string;
  readonly currency: Currency;
  readonly lines: readonly CartLine[];
};

/**
 * Derived, never stored: a stored subtotal can drift from the lines.
 */
export function subtotal(cart: Cart): number {
  return cart.lines.reduce(
    (total, line) => total + line.unitAmount * line.quantity,
    0,
  );
}

export function productIds(cart: Cart): string[] {
  return cart.lines.map((line) => line.productId);
}
