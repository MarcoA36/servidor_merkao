import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const departmentRouter = Router();

departmentRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { categories: true } }
      }
    });

    res.json({
      departments: departments.map((department) => ({
        id: department.id,
        name: department.name,
        slug: department.slug,
        categoryCount: department._count.categories
      }))
    });
  })
);
