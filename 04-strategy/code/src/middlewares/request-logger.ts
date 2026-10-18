import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";
import type { Logger } from "../lib/logger";

/** One structured log line per completed request. */
export function createRequestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();

    res.on("finish", () => {
      logger.info("http request", {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });

    next();
  };
}
