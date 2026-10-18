import "dotenv/config";
import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { createContainer } from "./composition-root";
import { createLogger } from "./lib/logger";

function main(): void {
  const config = loadConfig();
  const container = createContainer(config);
  const app = createApp(container);

  const server = app.listen(config.port, () => {
    const address = server.address();
    const port =
      typeof address === "object" && address ? address.port : config.port;

    container.logger.info("strategy demo API listening", {
      port,
      enabledDiscounts: config.enabledDiscounts,
      festivalEnabled: config.festival.enabled,
      try: [
        "GET /health",
        "GET /pricing/rules",
        "POST /checkout/quote",
      ],
    });
  });

  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    container.logger.info("shutdown requested", { signal });

    server.close((error) => {
      if (error) {
        container.logger.error("shutdown failed", { error: error.message });
        process.exit(1);
      }

      container.logger.info("shutdown complete", { signal });
      process.exit(0);
    });

    setTimeout(() => {
      container.logger.error("shutdown timed out", {
        timeoutMs: config.shutdownTimeoutMs,
      });
      process.exit(1);
    }, config.shutdownTimeoutMs).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

try {
  main();
} catch (error) {
  const logger = createLogger("error", { scope: "bootstrap" });
  logger.error("failed to start", {
    error:
      error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
  process.exit(1);
}
