import "dotenv/config";
import { performance } from "node:perf_hooks";
import { createApp } from "./app";
import { createContainer } from "./composition-root";
import { createLogger } from "./lib/logger";
import { createShutdownHandler } from "./server/shutdown";

async function main(): Promise<void> {
  const bootStartedAt = performance.now();
  const container = createContainer();
  const {
    config,
    logger,
    metrics,
    pool,
    cache,
    runtime,
    orderService,
  } = container;

  // Eager dependency check: fail before the port opens, not on the first
  // customer request. A real Prisma pool would `$connect()` here.
  await pool.ping();

  logger.info("infrastructure initialized", {
    instanceId: config.instanceId,
    poolId: pool.id,
    poolSize: config.dbPoolSize,
    cacheId: cache.id,
    metricsId: metrics.id,
    bootMs: Math.round(performance.now() - bootStartedAt),
  });

  const app = createApp({
    config,
    logger,
    metrics,
    pool,
    cache,
    orderService,
    runtime,
  });

  const server = app.listen(config.port, () => {
    const address = server.address();
    const port =
      typeof address === "object" && address ? address.port : config.port;

    logger.info("singleton demo API listening", {
      port,
      instanceId: config.instanceId,
      try: [
        "GET /health",
        "GET /system/info",
        "GET /system/pool",
        "GET /system/cache",
        "GET /orders",
        "POST /orders",
        "GET /metrics",
      ],
    });
  });

  const shutdown = createShutdownHandler({
    server,
    closeResources: container.shutdown,
    logger,
    timeoutMs: config.shutdownTimeoutMs,
    onShutdownStart: () => {
      runtime.shuttingDown = true;
    },
  });

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  const logger = createLogger("error", { scope: "bootstrap" });
  logger.error("failed to start", {
    error: error instanceof Error ? error.stack : String(error),
  });
  process.exit(1);
});
