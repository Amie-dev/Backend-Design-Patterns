import "dotenv/config";
import { z } from "zod";
import { ConfigurationError } from "../errors/payment.errors";
import type { LogLevel } from "../lib/logger";
import { PROVIDER_NAMES } from "../providers/payment-provider";

const booleanFlag = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3200),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  PAYMENTS_ENABLED: z.string().default("sandbox"),
  PAYMENTS_DEFAULT: z.string().min(1).optional(),
  PAYMENTS_CURRENCY_DEFAULTS: z.string().default("{}"),

  PAYMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  PAYMENT_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  PAYMENT_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(0).max(5_000).default(50),

  SANDBOX_LATENCY_MS: z.coerce.number().int().min(0).max(5_000).default(40),
  SANDBOX_SEED: z.coerce.number().int().default(42),
  SEED_DEMO: booleanFlag.default("true"),

  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
});

export type Config = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: LogLevel;
  enabledProviders: string[];
  defaultProvider: string;
  currencyDefaults: Record<string, string>;
  paymentTimeoutMs: number;
  paymentMaxRetries: number;
  paymentRetryBaseDelayMs: number;
  sandboxLatencyMs: number;
  sandboxSeed: number;
  seedDemo: boolean;
  stripeSecretKey?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
};

/**
 * Parse and validate configuration exactly once, at boot.
 *
 * Every failure here is a deployment error, not a request error: the process
 * should refuse to start rather than discover a missing key at checkout.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigurationError(`Invalid environment: ${issues}`);
  }

  const data = parsed.data;
  const enabledProviders = data.PAYMENTS_ENABLED.split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);

  if (enabledProviders.length === 0) {
    throw new ConfigurationError("PAYMENTS_ENABLED must list at least one provider");
  }

  const unknown = enabledProviders.filter(
    (name) => !(PROVIDER_NAMES as readonly string[]).includes(name),
  );
  if (unknown.length > 0) {
    throw new ConfigurationError(`Unknown payment providers: ${unknown.join(", ")}`);
  }

  const defaultProvider = (data.PAYMENTS_DEFAULT ?? enabledProviders[0]!).toLowerCase();
  if (!enabledProviders.includes(defaultProvider)) {
    throw new ConfigurationError(`Default provider is not enabled: ${defaultProvider}`);
  }

  if (enabledProviders.includes("stripe") && !data.STRIPE_SECRET_KEY) {
    throw new ConfigurationError("STRIPE_SECRET_KEY is required when stripe is enabled");
  }
  if (
    enabledProviders.includes("razorpay") &&
    (!data.RAZORPAY_KEY_ID || !data.RAZORPAY_KEY_SECRET)
  ) {
    throw new ConfigurationError(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when razorpay is enabled",
    );
  }

  // The sandbox is a development tool. Refuse to run it in production.
  if (data.NODE_ENV === "production" && enabledProviders.includes("sandbox")) {
    throw new ConfigurationError("The sandbox provider cannot be enabled in production");
  }

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    enabledProviders,
    defaultProvider,
    currencyDefaults: parseCurrencyDefaults(
      data.PAYMENTS_CURRENCY_DEFAULTS,
      enabledProviders,
    ),
    paymentTimeoutMs: data.PAYMENT_TIMEOUT_MS,
    paymentMaxRetries: data.PAYMENT_MAX_RETRIES,
    paymentRetryBaseDelayMs: data.PAYMENT_RETRY_BASE_DELAY_MS,
    sandboxLatencyMs: data.SANDBOX_LATENCY_MS,
    sandboxSeed: data.SANDBOX_SEED,
    seedDemo: data.SEED_DEMO,
    stripeSecretKey: data.STRIPE_SECRET_KEY,
    razorpayKeyId: data.RAZORPAY_KEY_ID,
    razorpayKeySecret: data.RAZORPAY_KEY_SECRET,
  };
}

function parseCurrencyDefaults(
  raw: string,
  enabledProviders: readonly string[],
): Record<string, string> {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new ConfigurationError("PAYMENTS_CURRENCY_DEFAULTS must be valid JSON");
  }

  const parsed = z.record(z.string(), z.string()).safeParse(value);
  if (!parsed.success) {
    throw new ConfigurationError(
      `Invalid PAYMENTS_CURRENCY_DEFAULTS: ${parsed.error.message}`,
    );
  }

  const result: Record<string, string> = {};

  for (const [currency, provider] of Object.entries(parsed.data)) {
    const normalized = provider.trim().toLowerCase();

    if (!enabledProviders.includes(normalized)) {
      throw new ConfigurationError(
        `Currency ${currency} maps to a disabled provider: ${provider}`,
      );
    }

    result[currency.trim().toUpperCase()] = normalized;
  }

  return result;
}
