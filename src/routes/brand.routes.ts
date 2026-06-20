import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const brandRouter = Router();

brandRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const brands = await prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        _count: { select: { products: { where: { isActive: true } } } }
      }
    });

    res.json({
      brands: brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        imageUrl: brand.imageUrl,
        productCount: brand._count.products
      }))
    });
  })
);
