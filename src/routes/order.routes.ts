import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { requireAdmin, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  cancelMyOrder,
  checkout,
  getAdminOrder,
  getMyOrder,
  getOrderVoucherHtml,
  listAdminOrders,
  listMyOrders,
  updateOrderStatus
} from "../services/order.service.js";

export const orderRouter = Router();
export const myOrderRouter = Router();
export const adminOrderRouter = Router();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

orderRouter.post(
  "/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const order = await checkout(authReq.user.id, req.body);
    res.status(201).json({ order });
  })
);

myOrderRouter.get(
  "/orders",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const orders = await listMyOrders(authReq.user.id);
    res.json({ orders });
  })
);

myOrderRouter.get(
  "/orders/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const order = await getMyOrder(authReq.user.id, getParam(req.params.id));
    res.json({ order });
  })
);

myOrderRouter.patch(
  "/orders/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const order = await cancelMyOrder(authReq.user.id, getParam(req.params.id));
    res.json({ order });
  })
);

adminOrderRouter.use(requireAuth, requireAdmin);

adminOrderRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const orders = await listAdminOrders(req.query.includeArchived === "true");
    res.json({ orders });
  })
);

adminOrderRouter.get(
  "/orders/:id",
  asyncHandler(async (req, res) => {
    const order = await getAdminOrder(getParam(req.params.id));
    res.json({ order });
  })
);

adminOrderRouter.get(
  "/orders/:id/voucher",
  asyncHandler(async (req, res) => {
    const html = await getOrderVoucherHtml(getParam(req.params.id));
    res.type("html").send(html);
  })
);

adminOrderRouter.patch(
  "/orders/:id/status",
  asyncHandler(async (req, res) => {
    const order = await updateOrderStatus(getParam(req.params.id), req.body);
    res.json({ order });
  })
);
