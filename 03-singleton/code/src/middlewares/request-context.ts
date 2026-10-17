import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";
import type { Config } from "../config/env";
import type { Logger } from "../lib/logger";
import { runWithRequestContext } from "../lib/request-context";
import type { RuntimeState } from "../lib/runtime";

/**
 * Create one AsyncLocalStorage scope per request and enrich it with identity.
 * In a real service `authenticate` would verify a token and fill `userId`.
 */
export function createRequestContextMiddleware(
  config: Config,
  logger: Logger,
  runtime: RuntimeState,
): RequestHandler {
  return (req, res, next) => {
    const requestId = req.header("x-request-id")?.trim() || randomUUID();
    const tenantId =
      req.header("x-tenant-id")?.trim() || config.defaultTenantId;
    const userId = req.header("x-user-id")?.trim() || config.defaultUserId;
    const startedAt = performance.now();

    res.setHeader("x-request-id", requestId);
    res.setHeader("x-instance-id", config.instanceId);
    runtime.requestsServed += 1;

    runWithRequestContext(
      { requestId, tenantId, userId, startedAt: Date.now() },
      () => {
        const log = logger.child({
          requestId,
          tenantId,
          userId,
          instanceId: config.instanceId,
        });
        res.locals.log = log;

        res.on("finish", () => {
          log.info("request completed", {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Math.round(performance.now() - startedAt),
          });
        });

        next();
      },
    );
  };
}
