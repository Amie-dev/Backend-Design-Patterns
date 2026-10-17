import { Router } from "express";
import type { SystemController } from "../controllers/system.controller";

export function createSystemRouter(controller: SystemController): Router {
  const router = Router();

  router.get("/info", controller.info);
  router.get("/context", controller.context);
  router.get("/pool", controller.pool);
  router.get("/cache", controller.cacheStats);

  return router;
}
