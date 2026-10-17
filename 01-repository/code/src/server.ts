import { createApp } from "./app";
import { createContainer } from "./composition-root";

function start(): void {
  const container = createContainer();
  const app = createApp(container.orders);

  const server = app.listen(container.config.PORT, () => {
    console.log(
      `API listening on http://localhost:${container.config.PORT} ` +
        `(repository: ${container.config.REPOSITORY})`,
    );
    console.log("Try: GET /orders?userId=usr_1, GET /orders/ord_demo_1");
  });

  const shutdown = (signal: string) => {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => {
      void container.shutdown().finally(() => process.exit(0));
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start();
