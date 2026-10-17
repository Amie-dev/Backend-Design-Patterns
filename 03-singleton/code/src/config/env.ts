import { z } from "zod";
import { ConfigurationError } from "../errors/app.errors";

const booleanish = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(0).max(65_535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  INSTANCE_ID: z.string().trim().min(1).max(64).default("local-1"),

  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(4),
  DB_QUERY_DELAY_MS: z.coerce.number().int().min(0).max(2_000).default(25),
  DB_ACQUIRE_TIMEOUT_MS: z.coerce.number().int().min(50).max(30_000).default(2_000),

  CACHE_TTL_MS: z.coerce.number().int().min(0).max(600_000).default(5_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(10_000),

  SEED_DEMO: booleanish.optional(),
  DEFAULT_TENANT_ID: z.string().trim().min(1).max(64).default("tenant_demo"),
  DEFAULT_USER_ID: z.string().trim().min(1).max(64).default("usr_demo"),
});

export type Config = Readonly<{
  nodeEnv: "development" | "test" | "production";
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
  instanceId: string;
  dbPoolSize: number;
  dbQueryDelayMs: number;
  dbAcquireTimeoutMs: number;
  cacheTtlMs: number;
  shutdownTimeoutMs: number;
  seedDemo: boolean;
  defaultTenantId: string;
  defaultUserId: string;
}>;

/**
 * Parse once, validate once, return one frozen object.
 *
 * The function accepts `env` so tests never have to mutate `process.env`;
 * `server.ts` decides when boot happens.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");

    throw new ConfigurationError(`Invalid environment: ${details}`);
  }

  const data = parsed.data;
  const seedDemo = data.SEED_DEMO ?? data.NODE_ENV !== "production";

  if (data.NODE_ENV === "production" && seedDemo) {
    throw new ConfigurationError(
      "SEED_DEMO must be false when NODE_ENV=production",
    );
  }

  return Object.freeze({
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    instanceId: data.INSTANCE_ID,
    dbPoolSize: data.DB_POOL_SIZE,
    dbQueryDelayMs: data.DB_QUERY_DELAY_MS,
    dbAcquireTimeoutMs: data.DB_ACQUIRE_TIMEOUT_MS,
    cacheTtlMs: data.CACHE_TTL_MS,
    shutdownTimeoutMs: data.SHUTDOWN_TIMEOUT_MS,
    seedDemo,
    defaultTenantId: data.DEFAULT_TENANT_ID,
    defaultUserId: data.DEFAULT_USER_ID,
  });
}
