import { PrismaClient } from "@prisma/client";

/**
 * One PrismaClient per process (see pattern 3, Singleton).
 * `datasourceUrl` lets tests point at a disposable database.
 */
export function createPrismaClient(datasourceUrl?: string): PrismaClient {
  return new PrismaClient(datasourceUrl ? { datasourceUrl } : undefined);
}
