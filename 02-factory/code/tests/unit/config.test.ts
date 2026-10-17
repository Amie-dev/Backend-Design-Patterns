import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env";
import { ConfigurationError } from "../../src/errors/payment.errors";

const baseEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  PAYMENTS_ENABLED: "sandbox",
  SEED_DEMO: "false",
};

describe("loadConfig", () => {
  it("returns safe demo defaults", () => {
    const config = loadConfig(baseEnv);

    expect(config.enabledProviders).toEqual(["sandbox"]);
    expect(config.defaultProvider).toBe("sandbox");
    expect(config.port).toBe(3200);
    expect(config.seedDemo).toBe(false);
    expect(config.paymentMaxRetries).toBe(2);
  });

  it("normalises provider names and defaults to the first enabled one", () => {
    const config = loadConfig({
      ...baseEnv,
      PAYMENTS_ENABLED: " SANDBOX , Stripe ",
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    expect(config.enabledProviders).toEqual(["sandbox", "stripe"]);
    expect(config.defaultProvider).toBe("sandbox");
  });

  it("honours PAYMENTS_DEFAULT", () => {
    const config = loadConfig({
      ...baseEnv,
      PAYMENTS_ENABLED: "sandbox,stripe",
      PAYMENTS_DEFAULT: "STRIPE",
      STRIPE_SECRET_KEY: "sk_test_123",
    });

    expect(config.defaultProvider).toBe("stripe");
  });

  it("rejects unknown providers", () => {
    expect(() =>
      loadConfig({ ...baseEnv, PAYMENTS_ENABLED: "sandbox,paypal" }),
    ).toThrow(/Unknown payment providers: paypal/);
  });

  it("rejects an empty enabled list", () => {
    expect(() => loadConfig({ ...baseEnv, PAYMENTS_ENABLED: " , " })).toThrow(
      ConfigurationError,
    );
  });

  it("rejects a default that is not enabled", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PAYMENTS_ENABLED: "sandbox",
        PAYMENTS_DEFAULT: "stripe",
      }),
    ).toThrow(/Default provider is not enabled/);
  });

  it("requires Stripe credentials when Stripe is enabled", () => {
    expect(() =>
      loadConfig({ ...baseEnv, PAYMENTS_ENABLED: "sandbox,stripe" }),
    ).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("requires Razorpay credentials when Razorpay is enabled", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PAYMENTS_ENABLED: "razorpay",
        RAZORPAY_KEY_ID: "rzp_test_123",
      }),
    ).toThrow(/RAZORPAY_KEY_SECRET/);
  });

  it("refuses to run the sandbox provider in production", () => {
    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: "production", PAYMENTS_ENABLED: "sandbox" }),
    ).toThrow(/sandbox provider cannot be enabled in production/);
  });

  it("parses and normalises currency defaults", () => {
    const config = loadConfig({
      ...baseEnv,
      PAYMENTS_ENABLED: "sandbox,stripe",
      STRIPE_SECRET_KEY: "sk_test_123",
      PAYMENTS_CURRENCY_DEFAULTS: '{"usd":"stripe"}',
    });

    expect(config.currencyDefaults).toEqual({ USD: "stripe" });
  });

  it("rejects a currency mapped to a disabled provider", () => {
    expect(() =>
      loadConfig({
        ...baseEnv,
        PAYMENTS_CURRENCY_DEFAULTS: '{"USD":"stripe"}',
      }),
    ).toThrow(/maps to a disabled provider/);
  });

  it("rejects malformed currency JSON", () => {
    expect(() =>
      loadConfig({ ...baseEnv, PAYMENTS_CURRENCY_DEFAULTS: "{not json" }),
    ).toThrow(/valid JSON/);
  });

  it("coerces numeric environment values", () => {
    const config = loadConfig({
      ...baseEnv,
      PORT: "4300",
      PAYMENT_MAX_RETRIES: "0",
      PAYMENT_TIMEOUT_MS: "1500",
    });

    expect(config.port).toBe(4300);
    expect(config.paymentMaxRetries).toBe(0);
    expect(config.paymentTimeoutMs).toBe(1500);
  });
});
