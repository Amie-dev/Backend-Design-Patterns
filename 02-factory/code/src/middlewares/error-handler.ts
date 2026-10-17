import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ProviderError } from "../errors/payment.errors";
import type { Logger } from "../lib/logger";

/**
 * One place maps domain errors to HTTP responses.
 * Controllers stay free of status-code logic beyond the happy path.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        code: "validation_error",
        details: error.issues,
      });
    }

    if (error instanceof AppError) {
      if (error.httpStatus >= 500) {
        logger.error("request failed", {
          method: req.method,
          path: req.path,
          code: error.code,
          message: error.message,
          cause: error.cause instanceof Error ? error.cause.message : undefined,
        });
      }

      if (error instanceof ProviderError && error.retryable) {
        res.setHeader("Retry-After", "5");
      }

      return res.status(error.httpStatus).json({
        error: error.message,
        code: error.code,
        ...error.details,
      });
    }

    logger.error("unhandled error", {
      method: req.method,
      path: req.path,
      error: error instanceof Error ? error.stack : String(error),
    });

    res.status(500).json({
      error: "Internal server error",
      code: "internal_error",
    });
  };
}
