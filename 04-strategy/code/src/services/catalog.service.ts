import { randomUUID } from "node:crypto";
import type { Cart } from "../domain/cart";
import type { Currency } from "../domain/money";
import {
  CurrencyMismatchError,
  InvalidCartError,
  UnknownProductError,
} from "../errors/discount.errors";
import type { CatalogRepository } from "../ports/catalog.repository";

export type CartItemInput = {
  readonly productId: string;
  readonly quantity: number;
};

/**
 * Turns product references into a cart with authoritative prices.
 *
 * The request never supplies money. This is the boundary that makes the
 * pricing rule trustworthy.
 */
export class CatalogService {
  constructor(private readonly products: CatalogRepository) {}

  async priceCart(
    userId: string,
    items: readonly CartItemInput[],
  ): Promise<Cart> {
    if (items.length === 0) {
      throw new InvalidCartError("Cart must contain at least one item");
    }

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new InvalidCartError(
          `Invalid quantity for ${item.productId}: ${item.quantity}`,
        );
      }
    }

    const ids = [...new Set(items.map((item) => item.productId))];
    const products = await this.products.findByIds(ids);
    const byId = new Map(products.map((product) => [product.id, product]));

    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new UnknownProductError(missing.join(", "));
    }

    const unavailable = products
      .filter((product) => !product.available)
      .map((product) => product.id);
    if (unavailable.length > 0) {
      throw new InvalidCartError(
        `Unavailable products: ${unavailable.join(", ")}`,
      );
    }

    const currencies = new Set(products.map((product) => product.currency));
    if (currencies.size > 1) {
      throw new CurrencyMismatchError();
    }

    const currency = products[0]?.currency as Currency;

    return {
      id: `cart_${randomUUID()}`,
      userId,
      currency,
      lines: items.map((item) => {
        const product = byId.get(item.productId);
        if (!product) {
          // Unreachable after the missing check, kept for type narrowing.
          throw new UnknownProductError(item.productId);
        }

        return {
          productId: product.id,
          quantity: item.quantity,
          unitAmount: product.unitAmount,
        };
      }),
    };
  }
}
