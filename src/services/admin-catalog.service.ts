import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { paginationArgs, paginationMeta, paginationQuerySchema } from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { recordInventoryMovement, stockAdjustmentQuantity } from "./inventory.service.js";
import { imageUrlSchema, productSchema } from "./product.service.js";

export const catalogNameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).optional(),
  imageUrl: imageUrlSchema.optional(),
  departmentId: z.string().trim().min(1).optional()
});

export const inventorySchema = z.object({
  price: z.coerce.number().positive().max(99999999).optional(),
  stock: z.coerce.number().int().min(0).max(999999).optional(),
  reason: z.string().trim().min(2).max(160).optional()
});

export const adminProductQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional()
});

export const inventoryMovementQuerySchema = paginationQuerySchema.extend({
  productId: z.string().trim().min(1).optional()
});

export const adminPromotionQuerySchema = paginationQuerySchema.extend({
  kind: z.enum(["all", "individual", "combo"]).default("all")
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).optional()
});

export const promotionSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    productIds: z.array(z.string().min(1)).min(1).max(20),
    startsAt: z.string().trim().optional().nullable(),
    endsAt: z.string().trim().optional().nullable(),
    promotionalPrice: z.coerce.number().positive().max(99999999),
    promotionalStock: z.coerce.number().int().min(0).max(999999),
    active: z.coerce.boolean().default(true),
    priority: z.enum(["featured", "normal", "secondary"]).default("normal")
  })
  .superRefine((data, context) => {
    if (data.startsAt && data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Promotion end date must be after start date",
        path: ["endsAt"]
      });
    }
  });

export const promotionStatusSchema = z.object({
  active: z.coerce.boolean()
});

const adminProductInclude = {
  category: { select: { id: true, name: true, slug: true, imageUrl: true, departmentId: true } },
  brand: { select: { id: true, name: true, slug: true, imageUrl: true } },
  owner: { select: { id: true, name: true, email: true } },
  quantityPrices: { orderBy: { from: "asc" } }
} satisfies Prisma.ProductInclude;

const promotionInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          price: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.PromotionInclude;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapProduct(product: Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>) {
  return {
    ...product,
    price: Number(product.price),
    effectivePrice: Number(product.price),
    quantityPrices: product.quantityPrices.map((range) => ({
      ...range,
      price: Number(range.price)
    }))
  };
}

function mapPromotion(promotion: Prisma.PromotionGetPayload<{ include: typeof promotionInclude }>) {
  return {
    ...promotion,
    startsAt: promotion.startsAt?.toISOString() ?? "",
    endsAt: promotion.endsAt?.toISOString() ?? "",
    promotionalPrice: Number(promotion.promotionalPrice),
    priority: promotion.priority.toLowerCase(),
    productIds: promotion.items.map((item) => item.productId),
    products: promotion.items.map((item) => ({
      ...item.product,
      price: Number(item.product.price)
    }))
  };
}

function handleUnique(error: unknown, entity: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new HttpError(409, `${entity} already exists`);
  }

  throw error;
}

export function listAdminCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { department: true, _count: { select: { products: true } } }
  });
}

export async function createAdminCategory(input: unknown) {
  const data = catalogNameSchema.parse(input);
  if (data.departmentId) {
    await assertDepartment(data.departmentId);
  }
  try {
    return await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug ?? slugify(data.name),
        imageUrl: data.imageUrl,
        departmentId: data.departmentId
      },
      include: { department: true, _count: { select: { products: true } } }
    });
  } catch (error) {
    handleUnique(error, "Category");
  }
}

export async function updateAdminCategory(id: string, input: unknown) {
  const data = catalogNameSchema.parse(input);
  if (data.departmentId) {
    await assertDepartment(data.departmentId);
  }
  try {
    return await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug ?? slugify(data.name),
        imageUrl: data.imageUrl ?? null,
        departmentId: data.departmentId ?? null
      },
      include: { department: true, _count: { select: { products: true } } }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Category not found");
    }
    handleUnique(error, "Category");
  }
}

export async function deleteAdminCategory(id: string) {
  const products = await prisma.product.count({ where: { categoryId: id } });
  if (products > 0) {
    throw new HttpError(409, "Category has associated products");
  }
  await prisma.category.delete({ where: { id } });
}

export function listAdminBrands() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } }
  });
}

export async function createAdminBrand(input: unknown) {
  const data = catalogNameSchema.parse(input);
  try {
    return await prisma.brand.create({
      data: { name: data.name, slug: data.slug ?? slugify(data.name), imageUrl: data.imageUrl },
      include: { _count: { select: { products: true } } }
    });
  } catch (error) {
    handleUnique(error, "Brand");
  }
}

export async function updateAdminBrand(id: string, input: unknown) {
  const data = catalogNameSchema.parse(input);
  try {
    return await prisma.brand.update({
      where: { id },
      data: { name: data.name, slug: data.slug ?? slugify(data.name), imageUrl: data.imageUrl ?? null },
      include: { _count: { select: { products: true } } }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Brand not found");
    }
    handleUnique(error, "Brand");
  }
}

export async function deleteAdminBrand(id: string) {
  const products = await prisma.product.count({ where: { brandId: id } });
  if (products > 0) {
    throw new HttpError(409, "Brand has associated products");
  }
  await prisma.brand.delete({ where: { id } });
}

export async function listAdminProducts(query: unknown) {
  const filters = adminProductQuerySchema.parse(query);
  const where: Prisma.ProductWhereInput = {
    OR: filters.search
      ? [
          { id: { contains: filters.search, mode: "insensitive" } },
          { name: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
          { category: { name: { contains: filters.search, mode: "insensitive" } } },
          { brand: { name: { contains: filters.search, mode: "insensitive" } } }
        ]
      : undefined
  };
  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: adminProductInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paginationArgs(filters)
    })
  ]);

  return {
    products: products.map(mapProduct),
    pagination: paginationMeta(total, filters)
  };
}

export async function createAdminProduct(adminUserId: string, input: unknown) {
  const data = productSchema.parse(input);
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        categoryId: data.categoryId,
        brandId: data.brandId,
        ownerId: adminUserId,
        quantityPrices: {
          create: data.quantityPrices.map((range) => ({
            from: range.from,
            to: range.to ?? null,
            price: range.price
          }))
        }
      },
      include: adminProductInclude
    });

    if (data.stock > 0) {
      await recordInventoryMovement(tx, {
        productId: created.id,
        type: "IN",
        quantity: data.stock,
        reason: "INITIAL_STOCK",
        changedByUserId: adminUserId
      });
    }

    return created;
  });
  return mapProduct(product);
}

export async function updateAdminProduct(adminUserId: string, id: string, input: unknown) {
  const data = productSchema.parse(input);
  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { stock: true } });
    if (!existing) {
      throw new HttpError(404, "Product not found");
    }

    await tx.quantityPriceRange.deleteMany({ where: { productId: id } });
    const updated = await tx.product.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl,
        categoryId: data.categoryId,
        brandId: data.brandId,
        quantityPrices: {
          create: data.quantityPrices.map((range) => ({
            from: range.from,
            to: range.to ?? null,
            price: range.price
          }))
        }
      },
      include: adminProductInclude
    });

    const stockDelta = stockAdjustmentQuantity(existing.stock, data.stock);
    if (stockDelta !== 0) {
      await recordInventoryMovement(tx, {
        productId: id,
        type: "ADJUSTMENT",
        quantity: stockDelta,
        reason: "PRODUCT_UPDATE",
        changedByUserId: adminUserId
      });
    }

    return updated;
  });
  return mapProduct(product);
}

export async function updateAdminInventory(adminUserId: string, id: string, input: unknown) {
  const data = inventorySchema.parse(input);
  const { reason, ...productData } = data;
  if (Object.keys(productData).length === 0) {
    throw new HttpError(400, "At least one inventory field is required");
  }

  const product = await prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id }, select: { stock: true } });
    if (!existing) {
      throw new HttpError(404, "Product not found");
    }

    const updated = await tx.product.update({
      where: { id },
      data: productData,
      include: adminProductInclude
    });

    if (data.stock !== undefined) {
      const stockDelta = stockAdjustmentQuantity(existing.stock, data.stock);
      if (stockDelta !== 0) {
        await recordInventoryMovement(tx, {
          productId: id,
          type: "ADJUSTMENT",
          quantity: stockDelta,
          reason: reason ?? "ADMIN_INVENTORY_UPDATE",
          changedByUserId: adminUserId
        });
      }
    }

    return updated;
  });
  return mapProduct(product);
}

export async function listAdminInventoryMovements(query: unknown) {
  const filters = inventoryMovementQuerySchema.parse(query);
  const where: Prisma.InventoryMovementWhereInput = { productId: filters.productId };
  const [total, movements] = await prisma.$transaction([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            stock: true,
            brand: { select: { id: true, name: true } }
          }
        },
        changedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...paginationArgs(filters)
    })
  ]);

  return {
    movements,
    pagination: paginationMeta(total, filters)
  };
}

export async function deleteAdminProduct(id: string) {
  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
}

export function listAdminDepartments() {
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { categories: true } } }
  });
}

export async function createAdminDepartment(input: unknown) {
  const data = departmentSchema.parse(input);
  try {
    return await prisma.department.create({
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
    });
  } catch (error) {
    handleUnique(error, "Department");
  }
}

export async function updateAdminDepartment(id: string, input: unknown) {
  const data = departmentSchema.parse(input);
  try {
    return await prisma.department.update({
      where: { id },
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(404, "Department not found");
    }
    handleUnique(error, "Department");
  }
}

export async function deleteAdminDepartment(id: string) {
  const categories = await prisma.category.count({ where: { departmentId: id } });
  if (categories > 0) {
    throw new HttpError(409, "Department has associated categories");
  }
  await prisma.department.delete({ where: { id } });
}

export async function listAdminPromotions(query: unknown) {
  const filters = adminPromotionQuerySchema.parse(query);
  const promotionIds = await promotionIdsByKind(filters.kind);
  const where: Prisma.PromotionWhereInput = {
    id: promotionIds ? { in: promotionIds } : undefined
  };
  const [total, promotions] = await prisma.$transaction([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      include: promotionInclude,
      orderBy: [{ active: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      ...paginationArgs(filters)
    })
  ]);

  return {
    promotions: promotions.map(mapPromotion),
    pagination: paginationMeta(total, filters)
  };
}

export async function createAdminPromotion(input: unknown) {
  const data = promotionSchema.parse(input);
  await assertProducts(data.productIds);
  const promotion = await prisma.promotion.create({
    data: promotionData(data),
    include: promotionInclude
  });
  return mapPromotion(promotion);
}

export async function updateAdminPromotion(id: string, input: unknown) {
  const data = promotionSchema.parse(input);
  await assertProducts(data.productIds);
  const promotion = await prisma.$transaction(async (tx) => {
    await tx.promotionItem.deleteMany({ where: { promotionId: id } });
    return tx.promotion.update({
      where: { id },
      data: promotionData(data),
      include: promotionInclude
    });
  });
  return mapPromotion(promotion);
}

export async function updateAdminPromotionStatus(id: string, input: unknown) {
  const data = promotionStatusSchema.parse(input);
  const promotion = await prisma.promotion.update({
    where: { id },
    data,
    include: promotionInclude
  });
  return mapPromotion(promotion);
}

export async function deleteAdminPromotion(id: string) {
  await prisma.promotion.delete({ where: { id } });
}

async function assertDepartment(id: string) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) {
    throw new HttpError(400, "Invalid department");
  }
}

async function assertProducts(productIds: string[]) {
  const products = await prisma.product.count({ where: { id: { in: productIds }, isActive: true } });
  if (products !== new Set(productIds).size) {
    throw new HttpError(400, "Invalid promotion products");
  }
}

function promotionData(data: z.infer<typeof promotionSchema>) {
  return {
    name: data.name,
    startsAt: parsePromotionDate(data.startsAt),
    endsAt: parsePromotionDate(data.endsAt, true),
    promotionalPrice: data.promotionalPrice,
    promotionalStock: data.promotionalStock,
    active: data.active,
    priority: priorityToPrisma(data.priority),
    items: {
      create: [...new Set(data.productIds)].map((productId) => ({ productId }))
    }
  };
}

function parsePromotionDate(value: string | null | undefined, endOfDay = false) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  return new Date(value);
}

function priorityToPrisma(priority: z.infer<typeof promotionSchema>["priority"]) {
  return {
    featured: "FEATURED",
    normal: "NORMAL",
    secondary: "SECONDARY"
  }[priority] as Prisma.PromotionCreateInput["priority"];
}

async function promotionIdsByKind(kind: z.infer<typeof adminPromotionQuerySchema>["kind"]) {
  if (kind === "all") return undefined;

  const rows =
    kind === "combo"
      ? await prisma.$queryRaw<Array<{ promotionId: string }>>`
          SELECT "promotionId"
          FROM "PromotionItem"
          GROUP BY "promotionId"
          HAVING COUNT(*) > 1
        `
      : await prisma.$queryRaw<Array<{ promotionId: string }>>`
          SELECT "promotionId"
          FROM "PromotionItem"
          GROUP BY "promotionId"
          HAVING COUNT(*) = 1
        `;

  return rows.map((row) => row.promotionId);
}
