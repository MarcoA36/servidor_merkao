import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { activePromotionWhere } from "./pricing.service.js";

const publicPromotionInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          price: true,
          brand: { select: { id: true, name: true, slug: true, imageUrl: true } },
          category: { select: { id: true, name: true, slug: true, imageUrl: true, departmentId: true } }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.PromotionInclude;

export async function listActivePromotions() {
  const promotions = await prisma.promotion.findMany({
    where: activePromotionWhere(),
    include: publicPromotionInclude,
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
  });

  return promotions.map((promotion) => ({
    ...promotion,
    startsAt: promotion.startsAt?.toISOString() ?? null,
    endsAt: promotion.endsAt?.toISOString() ?? null,
    promotionalPrice: Number(promotion.promotionalPrice),
    priority: promotion.priority.toLowerCase(),
    productIds: promotion.items.map((item) => item.productId),
    products: promotion.items.map((item) => ({
      ...item.product,
      price: Number(item.product.price),
      quantity: item.quantity
    }))
  }));
}
