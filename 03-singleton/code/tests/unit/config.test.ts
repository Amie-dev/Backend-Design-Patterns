import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env";
import { ConfigurationError } from "../../src/errors/app.errors";

describe("loadConfig", () => {
  it("applies development defaults", () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      nodeEnv: "development",
      port: 3000,
      logLevel: "info",
      instanceId: "local-1",
      dbPoolSize: 4,
      dbQueryDelayMs: 25,
      dbAcquireTimeoutMs: 2_000,
      cacheTtlMs: 5_000,
      shutdownTimeoutMs: 10_000,
      seedDemo: true,
      defaultTenantId: "tenant_demo",
    });
  });

  it("coerces numbers and booleans", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "4100",
      LOG_LEVEL: "debug",
      DB_POOL_SIZE: "8",
      DB_QUERY_DELAY_MS: "0",
      CACHE_TTL_MS: "0",
      SEED_DEMO: "false",
      INSTANCE_ID: "pod-a",
    });

    expect(config).toMatchObject({
      nodeEnv: "test",
      port: 4100,
      logLevel: "debug",
      dbPoolSize: 8,
      dbQueryDelayMs: 0,
      cacheTtlMs: 0,
      seedDemo: false,
      instanceId: "pod-a",
    });
  });

  it("freezes the config object", () => {
    expect(Object.isFrozen(loadConfig({ NODE_ENV: "test" }))).toBe(true);
  });

  it("rejects an out-of-range pool size and names the variable", () => {
    expect(() => loadConfig({ DB_POOL_SIZE: "0" })).toThrowError(
      /DB_POOL_SIZE/,
    );
    expect(() => loadConfig({ DB_POOL_SIZE: "0" })).toThrowError(
      ConfigurationError,
    );
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrowError(
      /LOG_LEVEL/,
    );
  });

  it("rejects a non-numeric port", () => {
    expect(() => loadConfig({ PORT: "http" })).toThrowError(/PORT/);
  });

  it("defaults seeding off in production", () => {
    expect(loadConfig({ NODE_ENV: "production" }).seedDemo).toBe(false);
  });

  it("refuses to seed demo data in production", () => {
    expect(() =>
      loadConfig({ NODE_ENV: "production", SEED_DEMO: "true" }),
    ).toThrowError(/SEED_DEMO must be false/);
  });
});
