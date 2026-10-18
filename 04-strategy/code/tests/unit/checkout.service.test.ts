import { describe, expect, it, vi } from "vitest";
import type { RolloutGate } from "../../src/lib/rollout";
import type { CustomerRepository } from "../../src/ports/customer.repository";
import type { PromotionRepository } from "../../src/ports/promotion.repository";
import type { DiscountStrategyRegistry } from "../../src/services/discount-strategy.registry";
import { DiscountStrategyRegistry as Registry } from "../../src/services/discount-strategy.registry";
import { CheckoutService } from "../../src/services/checkout.service";
import { PricingService } from "../../src/services/pricing.service";
import { NoDiscount } from "../../src/strategies/no-discount.strategy";
import { PremiumDiscount } from "../../src/strategies/premium-discount.strategy";
import { StudentDiscount } from "../../src/strategies/student-discount.strategy";
import { aCart } from "../builders/cart.builder";

const now = new Date("2026-02-01T10:00:00Z");
const alwaysOn: RolloutGate = { isEnabled: () => true };

function buildRealGraph() {
  const customers: CustomerRepository = {
    findById: async (id) => ({ id, type: "premium" }),
  };
  const promotions: PromotionRepository = { findActive: async () => null };
  const pricing = new PricingService(customers, promotions, alwaysOn);
  const registry = new Registry(
    new PremiumDiscount(),
    new StudentDiscount(),
    new NoDiscount(),
  );
  const clock = { now: vi.fn(() => now) };

  return {
    clock,
    service: new CheckoutService(pricing, registry, clock),
  };
}

describe("CheckoutService", () => {
  it("returns subtotal, discount, total, and the strategy key", async () => {
    const { clock, service } = buildRealGraph();
    const quote = await service.quote("usr_premium", aCart());

    expect(quote).toEqual({
      subtotal: 50_000,
      discount: 7_500,
      total: 42_500,
      strategy: "premium",
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it("clamps a rogue strategy so the total cannot go negative", async () => {
    const pricing = {
      resolvePolicy: async () => ({
        policy: { kind: "none" },
        customerType: "guest",
      }),
    } as unknown as PricingService;

    const rogue = { key: "none", calculate: () => 999_999 };
    const registry = {
      resolve: () => rogue,
    } as unknown as DiscountStrategyRegistry;

    const clock = { now: () => now };
    const service = new CheckoutService(pricing, registry, clock);

    const quote = await service.quote("usr_guest", aCart());

    expect(quote.discount).toBe(50_000);
    expect(quote.total).toBe(0);
  });
});
