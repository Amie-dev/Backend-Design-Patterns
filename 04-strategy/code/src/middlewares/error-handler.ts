import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { DomainError } from "../errors/discount.errors";
import type { Logger } from "../lib/logger";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: "invalid_request",
        message: "Request validation failed",
        requestId: req.id,
        issues: err.issues,
      });
      return;
    }

    if (err instanceof DomainError) {
      if (err.status >= 500) {
        logger.error("request failed", {
          requestId: req.id,
          code: err.code,
          error: err.message,
        });
      } else {
        logger.warn("request rejected", {
          requestId: req.id,
          code: err.code,
          error: err.message,
        });
      }

      res.status(err.status).json({
        error: err.code,
        message: err.message,
        requestId: req.id,
      });
      return;
    }

    logger.error("unhandled error", {
      requestId: req.id,
      error: err instanceof Error ? (err.stack ?? err.message) : String(err),
    });

    res.status(500).json({
      error: "internal_error",
      message: "Unexpected error",
      requestId: req.id,
    });
  };
}
