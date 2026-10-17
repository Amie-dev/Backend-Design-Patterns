import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";
import type { MetricsRegistry } from "../lib/metrics";

/**
 * Record every response once. Route labels are bounded (`/orders/:orderId`),
 * never raw ids.
 */
export function createHttpMetrics(metrics: MetricsRegistry): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();

    res.on("finish", () => {
      const route = req.route
        ? `${req.baseUrl}${req.route.path}`
        : "unmatched";
      const durationSeconds = (performance.now() - startedAt) / 1000;

      metrics.increment("http_requests_total", {
        method: req.method,
        route,
        status: res.statusCode,
      });
      metrics.observe("http_request_duration_seconds", durationSeconds, {
        method: req.method,
        route,
      });
    });

    next();
  };
}
