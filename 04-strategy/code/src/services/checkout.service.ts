import { productIds, subtotal, type Cart } from "../domain/cart";
import { clampDiscount } from "../domain/money";
import type { Clock } from "../lib/clock";
import type { DiscountKey } from "../strategies/discount-strategy";
import type { DiscountStrategyRegistry } from "./discount-strategy.registry";
import type { PricingService } from "./pricing.service";

export type CheckoutQuote = {
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly strategy: DiscountKey;
};

/**
 * Orchestrates one quote: resolve the policy, resolve the strategy, calculate,
 * enforce the invariant. It knows no rule arithmetic and no HTTP.
 */
export class CheckoutService {
  constructor(
    private readonly pricing: PricingService,
    private readonly registry: DiscountStrategyRegistry,
    private readonly clock: Clock,
  ) {}

  async quote(userId: string, cart: Cart): Promise<CheckoutQuote> {
    // One timestamp per checkout: policy resolution and calculation must not
    // observe different instants.
    const now = this.clock.now();

    const { policy, customerType } = await this.pricing.resolvePolicy(
      userId,
      cart,
      now,
    );

    const strategy = this.registry.resolve(policy);
    const amount = subtotal(cart);

    const discount = strategy.calculate({
      amount,
      currency: cart.currency,
      customerType,
      productIds: productIds(cart),
      now,
    });

    // Final defence: even a buggy strategy cannot produce a negative total.
    const safeDiscount = clampDiscount(discount, amount);

    return {
      subtotal: amount,
      discount: safeDiscount,
      total: amount - safeDiscount,
      strategy: strategy.key,
    };
  }
}
