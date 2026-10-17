import { createApp } from "./app";
import { createContainer } from "./composition-root";

function start(): void {
  const container = createContainer();
  const app = createApp(container);

  const server = app.listen(container.config.port, () => {
    container.logger.info("factory demo API listening", {
      port: container.config.port,
      providers: container.providerInfo,
      try: [
        "GET /orders",
        "POST /orders/ord_demo_inr/pay",
        "POST /orders/ord_demo_paid/refund",
        "GET /metrics",
      ],
    });
  });

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    container.logger.info("shutting down", { signal });

    const forceExit = setTimeout(() => {
      container.logger.error("forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(() => {
      clearTimeout(forceExit);
      void container.shutdown().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
