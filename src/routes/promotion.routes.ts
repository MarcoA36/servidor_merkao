import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { listActivePromotions } from "../services/promotion.service.js";

export const promotionRouter = Router();

promotionRouter.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const promotions = await listActivePromotions();
    res.json({ promotions });
  })
);
