import express, { type Express } from "express";
import type { OrderService } from "./services/order.service";
import { errorHandler } from "./middlewares/error-handler";
import { OrdersController } from "./controllers/orders.controller";
import { createOrdersRouter } from "./routes/orders.routes";

/**
 * Build the Express app from a service instance.
 * Taking the service as an argument keeps the app testable: tests inject a
 * fake-backed service without touching the composition root.
 */
export function createApp(orders: OrderService): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/orders", createOrdersRouter(new OrdersController(orders)));
  app.use(errorHandler);

  return app;
}
