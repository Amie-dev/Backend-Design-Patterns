import { Router } from "express";
import type { OrdersController } from "../controllers/orders.controller";

export function createOrdersRouter(controller: OrdersController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/:orderId", controller.getById);
  router.post("/:orderId/cancel", controller.cancel);

  return router;
}
