import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listMyProducts,
  listProducts,
  updateProduct
} from "../services/product.service.js";

export const productRouter = Router();
export const myProductRouter = Router();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

productRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await listProducts(req.query);
    res.json(result);
  })
);

productRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const product = await getProduct(getParam(req.params.id));
    res.json({ product });
  })
);

productRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const product = await createProduct(authReq.user.id, req.body);
    res.status(201).json({ product });
  })
);

productRouter.put(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const product = await updateProduct(authReq.user.id, getParam(req.params.id), req.body);
    res.json({ product });
  })
);

productRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await deleteProduct(authReq.user.id, getParam(req.params.id));
    res.status(204).send();
  })
);

myProductRouter.get(
  "/products",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const products = await listMyProducts(authReq.user.id);
    res.json({ products });
  })
);
