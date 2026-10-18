import type { Cart } from "../domain/cart";
import type { CustomerType } from "../domain/customer";
import type { DiscountPolicy } from "../domain/discount-policy";
import { UnknownCustomerError } from "../errors/discount.errors";
import type { RolloutGate } from "../lib/rollout";
import type { CustomerRepository } from "../ports/customer.repository";
import type { PromotionRepository } from "../ports/promotion.repository";

export type PricingDecision = {
  readonly policy: DiscountPolicy;
  readonly customerType: CustomerType;
};

/**
 * Selection lives here and nowhere else.
 *
 * It is the only collaborator that reads the customer profile and the
 * promotion table; strategies receive plain data.
 */
export class PricingService {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly promotions: PromotionRepository,
    private readonly rollout: RolloutGate,
  ) {}

  async resolvePolicy(
    userId: string,
    cart: Cart,
    now: Date,
  ): Promise<PricingDecision> {
    const profile = await this.customers.findById(userId);
    if (!profile) throw new UnknownCustomerError(userId);

    if (cart.lines.length === 0) {
      return { policy: { kind: "none" }, customerType: profile.type };
    }

    const promotion = await this.promotions.findActive(now);
    const festivalIsLive =
      promotion !== null &&
      this.rollout.isEnabled(userId, `festival:${promotion.id}`);

    // Precedence is a business rule: premium beats a campaign, a campaign
    // beats the student rate. Documented and covered by the policy tests.
    if (profile.type === "premium") {
      return { policy: { kind: "premium" }, customerType: profile.type };
    }

    if (festivalIsLive && promotion) {
      return {
        policy: {
          kind: "festival",
          fixedAmount: promotion.fixedAmount,
          excludedProductIds: promotion.excludedProductIds,
        },
        customerType: profile.type,
      };
    }

    if (profile.type === "student") {
      return { policy: { kind: "student" }, customerType: profile.type };
    }

    return { policy: { kind: "none" }, customerType: profile.type };
  }
}
