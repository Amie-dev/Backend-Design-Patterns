import { describe, expect, it } from "vitest";
import type { Cart } from "../../src/domain/cart";
import type { CustomerType } from "../../src/domain/customer";
import type { RolloutGate } from "../../src/lib/rollout";
import type { CustomerRepository } from "../../src/ports/customer.repository";
import type {
  FestivalPromotion,
  PromotionRepository,
} from "../../src/ports/promotion.repository";
import { PricingService } from "../../src/services/pricing.service";
import { aCart } from "../builders/cart.builder";

const now = new Date("2026-02-01T10:00:00Z");

const promotion: FestivalPromotion = {
  id: "promo_test",
  fixedAmount: 10_000,
  excludedProductIds: ["prod_sale"],
  startsAt: new Date("2026-01-25T00:00:00Z"),
  endsAt: new Date("2026-02-10T00:00:00Z"),
};

const alwaysOn: RolloutGate = { isEnabled: () => true };
const alwaysOff: RolloutGate = { isEnabled: () => false };

function serviceFor(
  type: CustomerType,
  activePromotion: FestivalPromotion | null,
  rollout: RolloutGate = alwaysOn,
): PricingService {
  const customers: CustomerRepository = {
    findById: async (id) => ({ id, type }),
  };
  const promotions: PromotionRepository = {
    findActive: async () => activePromotion,
  };

  return new PricingService(customers, promotions, rollout);
}

const cases: Array<
  [string, CustomerType, FestivalPromotion | null, RolloutGate, string]
> = [
  ["premium wins over a live campaign", "premium", promotion, alwaysOn, "premium"],
  ["premium with no campaign", "premium", null, alwaysOn, "premium"],
  ["student during a campaign", "student", promotion, alwaysOn, "festival"],
  ["guest during a campaign", "guest", promotion, alwaysOn, "festival"],
  ["student without a campaign", "student", null, alwaysOn, "student"],
  ["guest without a campaign", "guest", null, alwaysOn, "none"],
  ["rollout excluded: student falls back", "student", promotion, alwaysOff, "student"],
  ["rollout excluded: guest gets none", "guest", promotion, alwaysOff, "none"],
];

describe("PricingService.resolvePolicy", () => {
  it.each(cases)("%s", async (_name, type, activePromotion, rollout, expected) => {
    const decision = await serviceFor(type, activePromotion, rollout).resolvePolicy(
      "usr_test",
      aCart(),
      now,
    );

    expect(decision.policy.kind).toBe(expected);
    expect(decision.customerType).toBe(type);
  });

  it("returns none for an empty cart", async () => {
    const decision = await serviceFor("premium", promotion).resolvePolicy(
      "usr_test",
      aCart({ lines: [] }),
      now,
    );

    expect(decision.policy).toEqual({ kind: "none" });
  });

  it("fails for an unknown customer", async () => {
    const customers: CustomerRepository = { findById: async () => null };
    const promotions: PromotionRepository = { findActive: async () => null };
    const service = new PricingService(customers, promotions, alwaysOn);

    await expect(
      service.resolvePolicy("usr_missing", aCart() as Cart, now),
    ).rejects.toThrow(/No customer profile/);
  });
});
