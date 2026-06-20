import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { requireAdmin, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  createAdminBrand,
  createAdminCategory,
  createAdminDepartment,
  createAdminProduct,
  createAdminPromotion,
  deleteAdminBrand,
  deleteAdminCategory,
  deleteAdminDepartment,
  deleteAdminProduct,
  deleteAdminPromotion,
  listAdminBrands,
  listAdminCategories,
  listAdminDepartments,
  listAdminProducts,
  listAdminPromotions,
  updateAdminBrand,
  updateAdminCategory,
  updateAdminDepartment,
  updateAdminInventory,
  updateAdminProduct,
  updateAdminPromotion
} from "../services/admin-catalog.service.js";

export const adminCatalogRouter = Router();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

adminCatalogRouter.use(requireAuth, requireAdmin);

adminCatalogRouter.get("/departments", asyncHandler(async (_req, res) => {
  const departments = await listAdminDepartments();
  res.json({ departments });
}));

adminCatalogRouter.post("/departments", asyncHandler(async (req, res) => {
  const department = await createAdminDepartment(req.body);
  res.status(201).json({ department });
}));

adminCatalogRouter.put("/departments/:id", asyncHandler(async (req, res) => {
  const department = await updateAdminDepartment(getParam(req.params.id), req.body);
  res.json({ department });
}));

adminCatalogRouter.delete("/departments/:id", asyncHandler(async (req, res) => {
  await deleteAdminDepartment(getParam(req.params.id));
  res.status(204).send();
}));

adminCatalogRouter.get("/categories", asyncHandler(async (_req, res) => {
  const categories = await listAdminCategories();
  res.json({ categories });
}));

adminCatalogRouter.post("/categories", asyncHandler(async (req, res) => {
  const category = await createAdminCategory(req.body);
  res.status(201).json({ category });
}));

adminCatalogRouter.put("/categories/:id", asyncHandler(async (req, res) => {
  const category = await updateAdminCategory(getParam(req.params.id), req.body);
  res.json({ category });
}));

adminCatalogRouter.delete("/categories/:id", asyncHandler(async (req, res) => {
  await deleteAdminCategory(getParam(req.params.id));
  res.status(204).send();
}));

adminCatalogRouter.get("/brands", asyncHandler(async (_req, res) => {
  const brands = await listAdminBrands();
  res.json({ brands });
}));

adminCatalogRouter.post("/brands", asyncHandler(async (req, res) => {
  const brand = await createAdminBrand(req.body);
  res.status(201).json({ brand });
}));

adminCatalogRouter.put("/brands/:id", asyncHandler(async (req, res) => {
  const brand = await updateAdminBrand(getParam(req.params.id), req.body);
  res.json({ brand });
}));

adminCatalogRouter.delete("/brands/:id", asyncHandler(async (req, res) => {
  await deleteAdminBrand(getParam(req.params.id));
  res.status(204).send();
}));

adminCatalogRouter.get("/products", asyncHandler(async (_req, res) => {
  const products = await listAdminProducts();
  res.json({ products });
}));

adminCatalogRouter.post("/products", asyncHandler(async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const product = await createAdminProduct(authReq.user.id, req.body);
  res.status(201).json({ product });
}));

adminCatalogRouter.put("/products/:id", asyncHandler(async (req, res) => {
  const product = await updateAdminProduct(getParam(req.params.id), req.body);
  res.json({ product });
}));

adminCatalogRouter.patch("/products/:id/inventory", asyncHandler(async (req, res) => {
  const product = await updateAdminInventory(getParam(req.params.id), req.body);
  res.json({ product });
}));

adminCatalogRouter.delete("/products/:id", asyncHandler(async (req, res) => {
  await deleteAdminProduct(getParam(req.params.id));
  res.status(204).send();
}));

adminCatalogRouter.get("/promotions", asyncHandler(async (_req, res) => {
  const promotions = await listAdminPromotions();
  res.json({ promotions });
}));

adminCatalogRouter.post("/promotions", asyncHandler(async (req, res) => {
  const promotion = await createAdminPromotion(req.body);
  res.status(201).json({ promotion });
}));

adminCatalogRouter.put("/promotions/:id", asyncHandler(async (req, res) => {
  const promotion = await updateAdminPromotion(getParam(req.params.id), req.body);
  res.json({ promotion });
}));

adminCatalogRouter.delete("/promotions/:id", asyncHandler(async (req, res) => {
  await deleteAdminPromotion(getParam(req.params.id));
  res.status(204).send();
}));
