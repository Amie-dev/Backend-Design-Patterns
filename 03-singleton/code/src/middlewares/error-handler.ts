import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, PoolTimeoutError } from "../errors/app.errors";
import type { Logger } from "../lib/logger";
import { getRequestContext } from "../lib/request-context";

type BodyParserError = SyntaxError & { status?: number; type?: string };

/**
 * One place maps domain errors to HTTP responses. Controllers stay free of
 * status-code logic beyond the happy path.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    const context = getRequestContext();
    const base = {
      requestId: context?.requestId,
      tenantId: context?.tenantId,
      method: req.method,
      path: req.path,
    };

    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request",
        code: "validation_error",
        details: error.issues,
      });
    }

    const bodyParserError = error as BodyParserError;
    if (
      bodyParserError instanceof SyntaxError &&
      bodyParserError.status === 400 &&
      bodyParserError.type === "entity.parse.failed"
    ) {
      return res.status(400).json({
        error: "Malformed JSON body",
        code: "invalid_json",
      });
    }

    if (error instanceof AppError) {
      if (error.httpStatus >= 500) {
        logger.error("request failed", {
          ...base,
          code: error.code,
          message: error.message,
          cause:
            error.cause instanceof Error ? error.cause.message : undefined,
        });
      }

      if (error instanceof PoolTimeoutError) {
        res.setHeader("Retry-After", "1");
      }

      return res.status(error.httpStatus).json({
        error: error.message,
        code: error.code,
        ...error.details,
      });
    }

    logger.error("unhandled error", {
      ...base,
      error: error instanceof Error ? error.stack : String(error),
    });

    res.status(500).json({
      error: "Internal server error",
      code: "internal_error",
    });
  };
}
