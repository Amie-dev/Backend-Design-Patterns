import { Router } from "express";
import type { OrdersController } from "./orders.controller";

export function createOrdersRouter(controller: OrdersController): Router {
  const router = Router();

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/:id/cancel", controller.cancel);

  return router;
}
