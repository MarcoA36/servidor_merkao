import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { login, logout, refresh, register } from "../services/auth.service.js";

export const authRouter = Router();

authRouter.use(rateLimit({ windowMs: 60_000, max: 30 }));

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const response = await register(req.body);
    res.status(201).json(response);
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const response = await login(req.body);
    res.json(response);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const response = await refresh(req.body);
    res.json(response);
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await logout(req.body);
    res.status(204).send();
  })
);
