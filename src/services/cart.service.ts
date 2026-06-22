import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { activePromotionWhere, calculateCartPricing, promotionPricingInclude, type PromotionForPricing } from "./pricing.service.js";

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
      owner: { select: { id: true, name: true } },
      quantityPrices: { orderBy: { from: "asc" } }
    }
  }
} as const;

function mapCart(items: Array<Awaited<ReturnType<typeof prisma.cartItem.findMany>>[number] & { product: any }>, promotions: PromotionForPricing[]) {
  const pricing = calculateCartPricing(
    items.map((item) => ({ product: item.product, quantity: item.quantity })),
    promotions
  );
  const linesByProductId = new Map(pricing.lines.map((line) => [line.productId, line]));
  const mappedItems = items.map((item) => {
    const pricedLine = linesByProductId.get(item.productId);
    const unitPrice = pricedLine?.unitPrice ?? Number(item.product.price);
    const lineTotal = pricedLine?.lineTotal ?? unitPrice * item.quantity;
    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      pricingSource: pricedLine?.pricingSource ?? "BASE",
      product: {
        ...item.product,
        price: Number(item.product.price),
        effectivePrice: unitPrice,
        quantityPrices: item.product.quantityPrices.map((range: any) => ({
          ...range,
          price: Number(range.price)
        }))
      }
    };
  });

  return { items: mappedItems, subtotal: pricing.subtotal, total: pricing.total };
}

export async function getCart(userId: string) {
  const [items, promotions] = await Promise.all([
    prisma.cartItem.findMany({
      where: { userId },
      include: cartInclude,
      orderBy: { createdAt: "desc" }
    }),
    prisma.promotion.findMany({
      where: activePromotionWhere(),
      include: promotionPricingInclude
    })
  ]);

  return mapCart(items, promotions);
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
