import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    role: "CUSTOMER" | "ADMIN";
  };
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const [scheme, token] = header?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Authentication required"));
  }

  try {
    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;

  if (authReq.user.role !== "ADMIN") {
    return next(new HttpError(403, "Administrator credentials required"));
  }

  return next();
}
