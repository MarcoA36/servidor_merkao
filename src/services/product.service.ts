import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { recordInventoryMovement, stockAdjustmentQuantity } from "./inventory.service.js";
import { activePromotionWhere, calculateCartPricing, calculateProductUnitPrice, promotionPricingInclude } from "./pricing.service.js";

export const imageUrlSchema = z
  .string()
  .trim()
  .max(1_000_000)
  .refine((value) => /^https?:\/\//.test(value) || /^data:image\/(png|jpe?g|webp);base64,/.test(value), {
    message: "Image must be a URL or data image"
  });

export const quantityPriceRangeSchema = z.object({
  id: z.string().optional(),
  from: z.coerce.number().int().min(1).max(99999),
  to: z.coerce.number().int().min(1).max(99999).nullable().optional(),
  price: z.coerce.number().positive().max(99999999)
});

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1000),
  price: z.coerce.number().positive().max(99999999),
  quantityPrices: z
    .array(quantityPriceRangeSchema)
    .max(20)
    .default([])
    .superRefine((ranges, context) => {
      for (const [index, range] of ranges.entries()) {
        if (range.to !== null && range.to !== undefined && range.to < range.from) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Range end must be greater than or equal to range start",
            path: [index, "to"]
          });
        }
      }

      const sortedRanges = ranges
        .map((range, index) => ({ ...range, index }))
        .sort((left, right) => left.from - right.from);

      for (let index = 1; index < sortedRanges.length; index += 1) {
        const previous = sortedRanges[index - 1];
        const current = sortedRanges[index];
        const previousEnd = previous.to ?? Number.POSITIVE_INFINITY;

        if (current.from <= previousEnd) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Quantity price ranges cannot overlap",
            path: [current.index, "from"]
          });
        }
      }
    }),
  stock: z.coerce.number().int().min(0).max(999999),
  imageUrl: imageUrlSchema,
  categoryId: z.string().min(1),
  brandId: z.string().min(1)
});

export const productQuerySchema = z.object({
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  search: z.string().trim().optional(),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  promotionalOnly: z
    .preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === "true" || value === true) return true;
      if (value === "false" || value === false) return false;
      return value;
    }, z.boolean().optional())
    .default(false)
});

const productInclude = {
  category: { select: { id: true, name: true, slug: true, imageUrl: true, departmentId: true } },
  brand: { select: { id: true, name: true, slug: true, imageUrl: true } },
  owner: { select: { id: true, name: true } },
  quantityPrices: { orderBy: { from: "asc" } },
  promotionItems: {
    include: {
      promotion: {
        include: promotionPricingInclude
      }
    }
  }
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function mapProduct(product: ProductWithRelations) {
  const { promotionItems, ...rest } = product;
  const pricing = calculateCartPricing(
    [{ product, quantity: 1 }],
    promotionItems.map((item) => item.promotion)
  );
  const effectivePrice = pricing.lines[0]?.unitPrice ?? Number(product.price);

  return {
    ...rest,
    price: Number(product.price),
    effectivePrice,
    quantityPrices: product.quantityPrices.map((range) => ({
      ...range,
      price: Number(range.price)
    }))
  };
}

export function effectiveProductPrice(
  product: { price: unknown; quantityPrices?: Array<{ from: number; to: number | null; price: unknown }> },
  quantity = 1
) {
  return calculateProductUnitPrice({ id: "product", ...product }, quantity);
}

export async function listProducts(query: unknown) {
  const filters = productQuerySchema.parse(query);
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    promotionItems: filters.promotionalOnly ? { some: { promotion: activePromotionWhere() } } : undefined,
    OR: filters.search
      ? [
          { name: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } }
        ]
      : undefined
  };

  try {
    const products = await prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filters.limit + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0
    });

    const hasMore = products.length > filters.limit;
    const page = hasMore ? products.slice(0, filters.limit) : products;

    return {
      products: page.map(mapProduct),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      hasMore
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new HttpError(400, "Invalid product cursor");
    }

    throw error;
  }
}

export async function getProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: productInclude
  });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  return mapProduct(product);
}

export async function listMyProducts(ownerId: string) {
  const products = await prisma.product.findMany({
    where: { ownerId },
    include: productInclude,
    orderBy: { createdAt: "desc" }
  });

  return products.map(mapProduct);
}

export async function createProduct(ownerId: string, input: unknown) {
  const data = productSchema.parse(input);
  await assertCategoryAndBrand(data.categoryId, data.brandId);

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
        ownerId,
        quantityPrices: {
          create: data.quantityPrices.map((range) => ({
            from: range.from,
            to: range.to ?? null,
            price: range.price
          }))
        }
      },
      include: productInclude
    });

    if (data.stock > 0) {
      await recordInventoryMovement(tx, {
        productId: created.id,
        type: "IN",
        quantity: data.stock,
        reason: "INITIAL_STOCK",
        changedByUserId: ownerId
      });
    }

    return created;
  });

  return mapProduct(product);
}

export async function updateProduct(ownerId: string, id: string, input: unknown) {
  const data = productSchema.parse(input);
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw new HttpError(404, "Product not found");
  }

  if (existing.ownerId !== ownerId) {
    throw new HttpError(403, "You cannot edit this product");
  }

  await assertCategoryAndBrand(data.categoryId, data.brandId);

  const product = await prisma.$transaction(async (tx) => {
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
      include: productInclude
    });

    const stockDelta = stockAdjustmentQuantity(existing.stock, data.stock);
    if (stockDelta !== 0) {
      await recordInventoryMovement(tx, {
        productId: id,
        type: "ADJUSTMENT",
        quantity: stockDelta,
        reason: "PRODUCT_UPDATE",
        changedByUserId: ownerId
      });
    }

    return updated;
  });

  return mapProduct(product);
}

export async function deleteProduct(ownerId: string, id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw new HttpError(404, "Product not found");
  }

  if (existing.ownerId !== ownerId) {
    throw new HttpError(403, "You cannot delete this product");
  }

  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
}

async function assertCategoryAndBrand(categoryId: string, brandId: string) {
  const [category, brand] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId } }),
    prisma.brand.findUnique({ where: { id: brandId } })
  ]);

  if (!category) {
    throw new HttpError(400, "Invalid category");
  }

  if (!brand) {
    throw new HttpError(400, "Invalid brand");
  }
}
