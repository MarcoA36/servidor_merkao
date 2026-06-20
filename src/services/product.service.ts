import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const productSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1000),
  price: z.coerce.number().positive().max(99999999),
  promotionalPrice: z.coerce.number().positive().max(99999999).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(999999),
  imageUrl: z.string().trim().url().max(1000),
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
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  owner: { select: { id: true, name: true } }
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

function mapProduct(product: ProductWithRelations) {
  return {
    ...product,
    price: Number(product.price),
    promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
    effectivePrice: Number(product.promotionalPrice ?? product.price)
  };
}

export async function listProducts(query: unknown) {
  const filters = productQuerySchema.parse(query);
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    categoryId: filters.categoryId,
    brandId: filters.brandId,
    promotionalPrice: filters.promotionalOnly ? { not: null } : undefined,
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

  const product = await prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      promotionalPrice: data.promotionalPrice ?? null,
      stock: data.stock,
      imageUrl: data.imageUrl,
      categoryId: data.categoryId,
      brandId: data.brandId,
      ownerId
    },
    include: productInclude
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

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      promotionalPrice: data.promotionalPrice ?? null,
      stock: data.stock,
      imageUrl: data.imageUrl,
      categoryId: data.categoryId,
      brandId: data.brandId
    },
    include: productInclude
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
