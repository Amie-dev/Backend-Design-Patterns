import express, { type Express } from "express";
import { PaymentsController } from "./controllers/payments.controller";
import type { Logger } from "./lib/logger";
import type { MetricsRegistry } from "./lib/metrics";
import { createErrorHandler } from "./middlewares/error-handler";
import type { ProviderInfo } from "./providers/provider-info";
import { createPaymentsRouter } from "./routes/payments.routes";
import type { PaymentService } from "./services/payment.service";

export type AppDependencies = {
  payments: PaymentService;
  metrics: MetricsRegistry;
  providerInfo: ProviderInfo;
  logger: Logger;
};

/**
 * Build the Express app from ready-made dependencies. Tests inject a
 * fake-backed module; the server injects the composition root.
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      providers: deps.providerInfo.registered,
      enabled: deps.providerInfo.enabled,
      defaultProvider: deps.providerInfo.defaultProvider,
    });
  });

  app.get("/providers", (_req, res) => {
    res.json(deps.providerInfo);
  });

  app.get("/metrics", (_req, res) => {
    res.type("text/plain; version=0.0.4").send(deps.metrics.render());
  });

  app.use("/orders", createPaymentsRouter(new PaymentsController(deps.payments)));

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found", code: "route_not_found" });
  });

  app.use(createErrorHandler(deps.logger));

  return app;
}
