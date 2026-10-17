import type { Config } from "../../src/config/env";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: "test",
    port: 0,
    logLevel: "error",
    instanceId: "test-instance",
    dbPoolSize: 4,
    dbQueryDelayMs: 0,
    dbAcquireTimeoutMs: 500,
    cacheTtlMs: 5_000,
    shutdownTimeoutMs: 1_000,
    seedDemo: false,
    defaultTenantId: "tenant_demo",
    defaultUserId: "usr_demo",
    ...overrides,
  };
}
