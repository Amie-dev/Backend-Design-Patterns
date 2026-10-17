import express, { type Express } from "express";
import type { OrderService } from "./application/order.service";
import { errorHandler } from "./http/error-handler";
import { OrdersController } from "./http/orders.controller";
import { createOrdersRouter } from "./http/orders.routes";

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
