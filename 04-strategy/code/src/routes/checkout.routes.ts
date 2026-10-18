import { Router } from "express";
import type { CheckoutController } from "../controllers/checkout.controller";
import { asyncHandler } from "../middlewares/async-handler";
import { authenticate } from "../middlewares/authenticate";

export function createCheckoutRouter(controller: CheckoutController): Router {
  const router = Router();

  router.post("/quote", authenticate, asyncHandler(controller.quote));

  return router;
}
