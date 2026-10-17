import { Router } from "express";
import type { PaymentsController } from "../controllers/payments.controller";

export function createPaymentsRouter(controller: PaymentsController): Router {
  const router = Router();

  router.get("/", controller.list);
  router.get("/:orderId", controller.getById);
  router.get("/:orderId/payment", controller.getPayment);
  router.post("/:orderId/pay", controller.pay);
  router.post("/:orderId/refund", controller.refund);

  return router;
}
