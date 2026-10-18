import express, { type Express } from "express";
import type { Container } from "./composition-root";
import { createErrorHandler } from "./middlewares/error-handler";
import { requestId } from "./middlewares/request-id";
import { createRequestLogger } from "./middlewares/request-logger";
import { createCheckoutRouter } from "./routes/checkout.routes";

export function createApp(container: Container): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(requestId);
  app.use(createRequestLogger(container.logger));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Read-only description of the active rules, useful when learning the flow.
  app.get("/pricing/rules", (_req, res) => {
    const { enabledDiscounts, festival } = container.config;

    res.json({
      enabledDiscounts,
      precedence: ["premium", "festival", "student", "none"],
      festival: {
        enabled: festival.enabled,
        fixedAmount: festival.fixedAmount,
        excludedProductIds: festival.excludedProductIds,
        rolloutPercent: festival.rolloutPercent,
        startsAt: festival.startsAt.toISOString(),
        endsAt: festival.endsAt.toISOString(),
      },
    });
  });

  app.use("/checkout", createCheckoutRouter(container.checkoutController));

  app.use((_req, res) => {
    res.status(404).json({ error: "route_not_found" });
  });

  app.use(createErrorHandler(container.logger));

  return app;
}
