import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99)
});

export const cartQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(1).max(99)
});

const cartInclude = {
  product: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
      brand: { select: { id: true, name: true, slug: true } },
      owner: { select: { id: true, name: true } }
    }
  }
} as const;

function effectivePrice(product: { price: unknown; promotionalPrice: unknown }) {
  return Number(product.promotionalPrice ?? product.price);
}

function mapCart(items: Array<Awaited<ReturnType<typeof prisma.cartItem.findMany>>[number] & { product: any }>) {
  const mappedItems = items.map((item) => {
    const unitPrice = effectivePrice(item.product);
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      product: {
        ...item.product,
        price: Number(item.product.price),
        promotionalPrice: item.product.promotionalPrice ? Number(item.product.promotionalPrice) : null,
        effectivePrice: unitPrice
      }
    };
  });

  const subtotal = mappedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return { items: mappedItems, subtotal, total: subtotal };
}

export async function getCart(userId: string) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: cartInclude,
    orderBy: { createdAt: "desc" }
  });

  return mapCart(items);
}

export async function addCartItem(userId: string, input: unknown) {
  const data = cartItemSchema.parse(input);
  const product = await prisma.product.findFirst({ where: { id: data.productId, isActive: true } });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  if (product.stock < data.quantity) {
    throw new HttpError(409, "Not enough stock available");
  }

  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId: data.productId } },
    update: { quantity: data.quantity },
    create: { userId, productId: data.productId, quantity: data.quantity }
  });

  return getCart(userId);
}

export async function updateCartItem(userId: string, productId: string, input: unknown) {
  const data = cartQuantitySchema.parse(input);
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  if (product.stock < data.quantity) {
    throw new HttpError(409, "Not enough stock available");
  }

  const updated = await prisma.cartItem.updateMany({
    where: { userId, productId },
    data: { quantity: data.quantity }
  });

  if (updated.count === 0) {
    throw new HttpError(404, "Cart item not found");
  }

  return getCart(userId);
}

export async function removeCartItem(userId: string, productId: string) {
  await prisma.cartItem.deleteMany({ where: { userId, productId } });
  return getCart(userId);
}
