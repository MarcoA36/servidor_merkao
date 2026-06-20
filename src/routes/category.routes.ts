import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const categoryRouter = Router();

categoryRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        departmentId: true,
        department: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: { where: { isActive: true } } } }
      }
    });

    res.json({
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        departmentId: category.departmentId,
        department: category.department,
        productCount: category._count.products
      }))
    });
  })
);
