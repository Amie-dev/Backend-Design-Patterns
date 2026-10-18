import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

/** Attaches a correlation id to the request and every response. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id")?.trim();
  req.id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
