import { Prisma } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { productSchema } from "./product.service.js";

export const catalogNameSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).optional()
});

export const inventorySchema = z.object({
  price: z.coerce.number().positive().max(99999999).optional(),
  promotionalPrice: z.coerce.number().positive().max(99999999).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(999999).optional()
});

const adminProductInclude = {
  category: { select: { id: true, name: true, slug: true } },
  brand: { select: { id: true, name: true, slug: true } },
  owner: { select: { id: true, name: true, email: true } }
} satisfies Prisma.ProductInclude;

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
    promotionalPrice: product.promotionalPrice ? Number(product.promotionalPrice) : null,
    effectivePrice: Number(product.promotionalPrice ?? product.price)
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
    include: { _count: { select: { products: true } } }
  });
}

export async function createAdminCategory(input: unknown) {
  const data = catalogNameSchema.parse(input);
  try {
    return await prisma.category.create({
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
    });
  } catch (error) {
    handleUnique(error, "Category");
  }
}

export async function updateAdminCategory(id: string, input: unknown) {
  const data = catalogNameSchema.parse(input);
  try {
    return await prisma.category.update({
      where: { id },
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
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
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
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
      data: { name: data.name, slug: data.slug ?? slugify(data.name) }
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

export async function listAdminProducts() {
  const products = await prisma.product.findMany({
    include: adminProductInclude,
    orderBy: { createdAt: "desc" }
  });
  return products.map(mapProduct);
}

export async function createAdminProduct(adminUserId: string, input: unknown) {
  const data = productSchema.parse(input);
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
      ownerId: adminUserId
    },
    include: adminProductInclude
  });
  return mapProduct(product);
}

export async function updateAdminProduct(id: string, input: unknown) {
  const data = productSchema.parse(input);
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
    include: adminProductInclude
  });
  return mapProduct(product);
}

export async function updateAdminInventory(id: string, input: unknown) {
  const data = inventorySchema.parse(input);
  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "At least one inventory field is required");
  }
  const product = await prisma.product.update({
    where: { id },
    data,
    include: adminProductInclude
  });
  return mapProduct(product);
}

export async function deleteAdminProduct(id: string) {
  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  });
}
