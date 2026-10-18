import { z } from "zod";
import {
  DISCOUNT_KEYS,
  type DiscountKey,
} from "../strategies/discount-strategy";

const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Comma-separated strategy keys. Unknown names fail at boot.
  DISCOUNTS_ENABLED: z.string().default("premium,student"),

  FESTIVAL_ENABLED: booleanish.default("true"),
  FESTIVAL_FIXED_AMOUNT: z.coerce.number().int().positive().default(10_000),
  FESTIVAL_EXCLUDED_IDS: z.string().default("prod_sale"),
  FESTIVAL_ROLLOUT_PERCENT: z.coerce.number().int().min(0).max(100).default(100),
  FESTIVAL_STARTS_AT: z.string().datetime().optional(),
  FESTIVAL_ENDS_AT: z.string().datetime().optional(),

  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type FestivalConfig = {
  readonly enabled: boolean;
  readonly fixedAmount: number;
  readonly excludedProductIds: readonly string[];
  readonly rolloutPercent: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
};

export type AppConfig = {
  readonly nodeEnv: "development" | "test" | "production";
  readonly port: number;
  readonly logLevel: "debug" | "info" | "warn" | "error";
  readonly enabledDiscounts: readonly DiscountKey[];
  readonly festival: FestivalConfig;
  readonly shutdownTimeoutMs: number;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * Parse configuration exactly once, at boot. Nothing below the composition
 * root reads `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  const enabled = [
    ...new Set(
      parsed.DISCOUNTS_ENABLED.split(",")
        .map((key) => key.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];

  const unknown = enabled.filter(
    (key) => !DISCOUNT_KEYS.includes(key as DiscountKey),
  );

  if (unknown.length > 0) {
    throw new Error(`Unknown discount strategies: ${unknown.join(", ")}`);
  }

  const now = new Date();
  const startsAt = parsed.FESTIVAL_STARTS_AT
    ? new Date(parsed.FESTIVAL_STARTS_AT)
    : new Date(now.getTime() - DAY_MS);
  const endsAt = parsed.FESTIVAL_ENDS_AT
    ? new Date(parsed.FESTIVAL_ENDS_AT)
    : new Date(now.getTime() + 30 * DAY_MS);

  if (endsAt <= startsAt) {
    throw new Error("FESTIVAL_ENDS_AT must be after FESTIVAL_STARTS_AT");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    enabledDiscounts: enabled as DiscountKey[],
    festival: {
      enabled: parsed.FESTIVAL_ENABLED,
      fixedAmount: parsed.FESTIVAL_FIXED_AMOUNT,
      excludedProductIds: parsed.FESTIVAL_EXCLUDED_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean),
      rolloutPercent: parsed.FESTIVAL_ROLLOUT_PERCENT,
      startsAt,
      endsAt,
    },
    shutdownTimeoutMs: parsed.SHUTDOWN_TIMEOUT_MS,
  };
}
