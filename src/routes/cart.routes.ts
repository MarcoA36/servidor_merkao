import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { addCartItem, getCart, removeCartItem, updateCartItem } from "../services/cart.service.js";

export const cartRouter = Router();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

cartRouter.use(requireAuth);

cartRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const cart = await getCart(authReq.user.id);
    res.json({ cart });
  })
);

cartRouter.post(
  "/items",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const cart = await addCartItem(authReq.user.id, req.body);
    res.status(201).json({ cart });
  })
);

cartRouter.put(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const cart = await updateCartItem(authReq.user.id, getParam(req.params.productId), req.body);
    res.json({ cart });
  })
);

cartRouter.delete(
  "/items/:productId",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const cart = await removeCartItem(authReq.user.id, getParam(req.params.productId));
    res.json({ cart });
  })
);
