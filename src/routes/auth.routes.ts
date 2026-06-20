import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { login, register } from "../services/auth.service.js";

export const authRouter = Router();

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
