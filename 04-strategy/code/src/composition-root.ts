import { loadConfig, type AppConfig } from "./config/env";
import { CheckoutController } from "./controllers/checkout.controller";
import { systemClock, type Clock } from "./lib/clock";
import { createLogger, type Logger } from "./lib/logger";
import { PercentRolloutGate, type RolloutGate } from "./lib/rollout";
import type { CatalogRepository } from "./ports/catalog.repository";
import type { CustomerRepository } from "./ports/customer.repository";
import type {
  FestivalPromotion,
  PromotionRepository,
} from "./ports/promotion.repository";
import { InMemoryCatalogRepository } from "./repositories/in-memory-catalog.repository";
import { InMemoryCustomerRepository } from "./repositories/in-memory-customer.repository";
import { InMemoryPromotionRepository } from "./repositories/in-memory-promotion.repository";
import { CatalogService } from "./services/catalog.service";
import { CheckoutService } from "./services/checkout.service";
import { DiscountStrategyRegistry } from "./services/discount-strategy.registry";
import { PricingService } from "./services/pricing.service";
import { NoDiscount } from "./strategies/no-discount.strategy";
import { PremiumDiscount } from "./strategies/premium-discount.strategy";
import { StudentDiscount } from "./strategies/student-discount.strategy";

export type ContainerOverrides = {
  customers?: CustomerRepository;
  promotions?: PromotionRepository;
  catalog?: CatalogRepository;
  clock?: Clock;
  rollout?: RolloutGate;
  logger?: Logger;
};

export type Container = {
  config: AppConfig;
  logger: Logger;
  customers: CustomerRepository;
  promotions: PromotionRepository;
  catalog: CatalogService;
  registry: DiscountStrategyRegistry;
  pricing: PricingService;
  checkout: CheckoutService;
  checkoutController: CheckoutController;
};

/**
 * The only module that constructs the object graph.
 *
 * Boot passes configuration; tests pass overrides (fake ports, fixed clock,
 * no-op logger). Nothing here is a module-level singleton, so every test gets
 * a fresh graph.
 */
export function createContainer(
  config: AppConfig = loadConfig(),
  overrides: ContainerOverrides = {},
): Container {
  const clock = overrides.clock ?? systemClock;
  const logger = overrides.logger ?? createLogger(config.logLevel);

  const customers =
    overrides.customers ?? new InMemoryCustomerRepository();

  const promotion: FestivalPromotion = {
    id: "promo_festival_demo",
    fixedAmount: config.festival.fixedAmount,
    excludedProductIds: [...config.festival.excludedProductIds],
    startsAt: config.festival.startsAt,
    endsAt: config.festival.endsAt,
  };

  const promotions =
    overrides.promotions ??
    new InMemoryPromotionRepository({
      enabled: config.festival.enabled,
      promotion,
    });

  const catalogRepository =
    overrides.catalog ?? new InMemoryCatalogRepository();
  const rollout =
    overrides.rollout ??
    new PercentRolloutGate(config.festival.rolloutPercent);

  // Disabled premium/student rules are wired to the null object: even if the
  // resolver selects them, they cannot grant money.
  const none = new NoDiscount();
  const registry = new DiscountStrategyRegistry(
    config.enabledDiscounts.includes("premium")
      ? new PremiumDiscount()
      : none,
    config.enabledDiscounts.includes("student")
      ? new StudentDiscount()
      : none,
    none,
  );

  const pricing = new PricingService(customers, promotions, rollout);
  const checkout = new CheckoutService(pricing, registry, clock);
  const catalog = new CatalogService(catalogRepository);

  return {
    config,
    logger,
    customers,
    promotions,
    catalog,
    registry,
    pricing,
    checkout,
    checkoutController: new CheckoutController(catalog, checkout),
  };
}
