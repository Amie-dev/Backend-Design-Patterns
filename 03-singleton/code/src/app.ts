import express, { type Express } from "express";
import type { Config } from "./config/env";
import { OrdersController } from "./controllers/orders.controller";
import { SystemController } from "./controllers/system.controller";
import type { TtlCache } from "./infrastructure/cache";
import type { DatabasePool } from "./infrastructure/database";
import type { Logger } from "./lib/logger";
import type { MetricsRegistry } from "./lib/metrics";
import type { RuntimeState } from "./lib/runtime";
import { createErrorHandler } from "./middlewares/error-handler";
import { createHttpMetrics } from "./middlewares/http-metrics";
import { createRequestContextMiddleware } from "./middlewares/request-context";
import { createOrdersRouter } from "./routes/orders.routes";
import { createSystemRouter } from "./routes/system.routes";
import type { OrderService } from "./services/order.service";

export type AppDependencies = {
  config: Config;
  logger: Logger;
  metrics: MetricsRegistry;
  pool: DatabasePool;
  cache: TtlCache;
  orderService: OrderService;
  runtime: RuntimeState;
};

/**
 * Build the Express app from ready-made dependencies. Tests inject a
 * fresh container; the server injects the process-wide one.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();
  const system = new SystemController({
    config: deps.config,
    pool: deps.pool,
    cache: deps.cache,
    metrics: deps.metrics,
    runtime: deps.runtime,
  });

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(
    createRequestContextMiddleware(deps.config, deps.logger, deps.runtime),
  );
  app.use(createHttpMetrics(deps.metrics));

  app.get("/health", system.health);
  app.get("/ready", system.ready);
  app.get("/metrics", system.prometheus);
  app.use("/system", createSystemRouter(system));
  app.use(
    "/orders",
    createOrdersRouter(new OrdersController(deps.orderService)),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found", code: "route_not_found" });
  });
  app.use(createErrorHandler(deps.logger));

  return app;
}
