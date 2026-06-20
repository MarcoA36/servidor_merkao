import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import {
  createAddress,
  deleteAddress,
  getProfile,
  listAddresses,
  updateAddress,
  updateProfile
} from "../services/profile.service.js";

export const profileRouter = Router();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

profileRouter.use(requireAuth);

profileRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await getProfile(authReq.user.id);
    res.json({ user });
  })
);

profileRouter.put(
  "/profile",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const user = await updateProfile(authReq.user.id, req.body);
    res.json({ user });
  })
);

profileRouter.get(
  "/addresses",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const addresses = await listAddresses(authReq.user.id);
    res.json({ addresses });
  })
);

profileRouter.post(
  "/addresses",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const address = await createAddress(authReq.user.id, req.body);
    res.status(201).json({ address });
  })
);

profileRouter.put(
  "/addresses/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const address = await updateAddress(authReq.user.id, getParam(req.params.id), req.body);
    res.json({ address });
  })
);

profileRouter.delete(
  "/addresses/:id",
  asyncHandler(async (req, res) => {
    const authReq = req as AuthenticatedRequest;
    await deleteAddress(authReq.user.id, getParam(req.params.id));
    res.status(204).send();
  })
);
