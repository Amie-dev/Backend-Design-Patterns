export {};

declare global {
  namespace Express {
    interface Request {
      /** Correlation id, set by the request-id middleware. */
      id: string;
      /** Set by the authenticate middleware; never supplied by the body. */
      user?: { id: string; roles: string[] };
    }
  }
}
