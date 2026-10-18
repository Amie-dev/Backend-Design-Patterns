import type { AppConfig } from "../../src/config/env";

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 0,
    logLevel: "error",
    enabledDiscounts: ["premium", "student"],
    festival: {
      enabled: true,
      fixedAmount: 10_000,
      excludedProductIds: ["prod_sale"],
      rolloutPercent: 100,
      startsAt: new Date("2026-01-25T00:00:00Z"),
      endsAt: new Date("2026-02-10T00:00:00Z"),
    },
    shutdownTimeoutMs: 1_000,
    ...overrides,
  };
}
