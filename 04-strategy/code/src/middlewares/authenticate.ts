import type { RequestHandler } from "express";

/**
 * Demo authentication. A real service verifies a JWT or session and attaches
 * the same `req.user` shape, so nothing downstream changes.
 */
export const DEMO_TOKENS: Record<string, { id: string; roles: string[] }> = {
  "premium-token": { id: "usr_premium", roles: ["customer"] },
  "student-token": { id: "usr_student", roles: ["customer"] },
  "guest-token": { id: "usr_guest", roles: ["customer"] },
};

export const authenticate: RequestHandler = (req, res, next) => {
  const header = req.header("authorization");
  const token =
    header?.startsWith("Bearer ") === true
      ? header.slice("Bearer ".length).trim()
      : null;

  if (!token) {
    res.status(401).json({
      error: "unauthorized",
      message: "Provide Authorization: Bearer <token>",
    });
    return;
  }

  const user = DEMO_TOKENS[token];
  if (!user) {
    res.status(401).json({
      error: "unauthorized",
      message: "Unknown demo token",
    });
    return;
  }

  req.user = user;
  next();
};
