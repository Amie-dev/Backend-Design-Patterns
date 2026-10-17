import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import {
  OrderNotFoundError,
  OrderStateError,
  RepositoryError,
} from "../domain/errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      details: err.issues,
    });
  }

  if (err instanceof OrderNotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  if (err instanceof OrderStateError) {
    return res.status(409).json({ error: err.message });
  }

  if (err instanceof RepositoryError) {
    console.error("Repository failure:", err.cause ?? err);
    return res.status(500).json({ error: "Persistence failure" });
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
};
