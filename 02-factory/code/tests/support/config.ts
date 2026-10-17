import type { Config } from "../../src/config/env";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: "test",
    port: 0,
    logLevel: "error",
    enabledProviders: ["sandbox"],
    defaultProvider: "sandbox",
    currencyDefaults: {},
    paymentTimeoutMs: 1_000,
    paymentMaxRetries: 0,
    paymentRetryBaseDelayMs: 0,
    sandboxLatencyMs: 0,
    sandboxSeed: 1,
    seedDemo: false,
    ...overrides,
  };
}
