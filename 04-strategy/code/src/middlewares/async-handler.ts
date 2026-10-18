import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Express 4 does not forward rejected promises. Without this wrapper an
 * async controller rejection becomes an unhandled rejection instead of a 500.
 */
export function asyncHandler(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
