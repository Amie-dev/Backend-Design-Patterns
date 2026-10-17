import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  REPOSITORY: z.enum(["memory", "postgres"]).default("memory"),
  SEED_DEMO: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  DATABASE_URL: z.string().url().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = envSchema.parse(env);

  if (config.REPOSITORY === "postgres" && !config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when REPOSITORY=postgres");
  }

  return config;
}
