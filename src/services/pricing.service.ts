import { Prisma } from "@prisma/client";

export const promotionPricingInclude = {
  items: {
    select: {
      productId: true,
      quantity: true
    },
    orderBy: { createdAt: "asc" }
  }
} satisfies Prisma.PromotionInclude;

export type PromotionForPricing = Prisma.PromotionGetPayload<{ include: typeof promotionPricingInclude }>;

export type PriceSource = "COMBO" | "PROMOTION" | "QUANTITY" | "BASE" | "MIXED";

export type ProductForPricing = {
  id: string;
  price: unknown;
  quantityPrices?: Array<{
    from: number;
    to: number | null;
    price: unknown;
  }>;
};

export type CartItemForPricing = {
  product: ProductForPricing;
  quantity: number;
};

export type PricedCartLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  pricingSource: PriceSource;
};

export type PromotionUsageDraft = {
  promotionId: string;
  promotionName: string;
  quantity: number;
  promotionalPrice: number;
  pricingSource: "COMBO" | "PROMOTION";
};

type WorkingLine = {
  product: ProductForPricing;
  quantity: number;
  remaining: number;
  lineTotalCents: number;
  sources: Set<PriceSource>;
};

export function activePromotionWhere(at = new Date()): Prisma.PromotionWhereInput {
  return {
    active: true,
    promotionalStock: { gt: 0 },
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: at } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: at } }] }
    ]
  };
}

export function calculateProductUnitPrice(product: ProductForPricing, quantity = 1) {
  const quantityPrice = quantityPriceCents(product, quantity);
  return centsToMoney(quantityPrice ?? moneyToCents(product.price));
}

export function calculateCartPricing(items: CartItemForPricing[], promotions: PromotionForPricing[], at = new Date()) {
  const lines = items.map<WorkingLine>((item) => ({
    product: item.product,
    quantity: item.quantity,
    remaining: item.quantity,
    lineTotalCents: 0,
    sources: new Set()
  }));
  const linesByProductId = new Map(lines.map((line) => [line.product.id, line]));
  const usages: PromotionUsageDraft[] = [];
  const activePromotions = promotions.filter((promotion) => isPromotionActive(promotion, at)).sort(comparePromotions);

  for (const promotion of activePromotions.filter((entry) => entry.items.length > 1)) {
    const requirements = promotionRequirements(promotion);
    const maxApplications = maxPromotionApplications(requirements, linesByProductId);
    const applications = Math.min(maxApplications, promotion.promotionalStock);

    if (applications <= 0) continue;

    applyPromotionGroup(promotion, requirements, applications, linesByProductId, "COMBO");
    usages.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      quantity: applications,
      promotionalPrice: toMoney(promotion.promotionalPrice),
      pricingSource: "COMBO"
    });
  }

  for (const promotion of activePromotions.filter((entry) => entry.items.length === 1)) {
    const requirements = promotionRequirements(promotion);
    const maxApplications = maxPromotionApplications(requirements, linesByProductId);
    const applications = Math.min(maxApplications, promotion.promotionalStock);

    if (applications <= 0) continue;

    applyPromotionGroup(promotion, requirements, applications, linesByProductId, "PROMOTION");
    usages.push({
      promotionId: promotion.id,
      promotionName: promotion.name,
      quantity: applications,
      promotionalPrice: toMoney(promotion.promotionalPrice),
      pricingSource: "PROMOTION"
    });
  }

  for (const line of lines) {
    if (line.remaining <= 0) continue;

    const unitPriceCents = quantityPriceCents(line.product, line.remaining);
    if (unitPriceCents !== null) {
      line.lineTotalCents += unitPriceCents * line.remaining;
      line.sources.add("QUANTITY");
    } else {
      line.lineTotalCents += moneyToCents(line.product.price) * line.remaining;
      line.sources.add("BASE");
    }
    line.remaining = 0;
  }

  const pricedLines = lines.map<PricedCartLine>((line) => ({
    productId: line.product.id,
    quantity: line.quantity,
    unitPrice: roundMoney(centsToMoney(line.lineTotalCents) / line.quantity),
    lineTotal: centsToMoney(line.lineTotalCents),
    pricingSource: line.sources.size === 1 ? [...line.sources][0] : "MIXED"
  }));

  const subtotal = centsToMoney(lines.reduce((sum, line) => sum + line.lineTotalCents, 0));

  return {
    lines: pricedLines,
    promotionUsages: usages,
    subtotal,
    total: subtotal
  };
}

function applyPromotionGroup(
  promotion: PromotionForPricing,
  requirements: Map<string, number>,
  applications: number,
  linesByProductId: Map<string, WorkingLine>,
  source: "COMBO" | "PROMOTION"
) {
  const totalPromotionCents = moneyToCents(promotion.promotionalPrice) * applications;
  const requiredEntries = [...requirements.entries()];
  const baseTotalCents = requiredEntries.reduce((sum, [productId, quantity]) => {
    const line = linesByProductId.get(productId);
    return sum + moneyToCents(line?.product.price ?? 0) * quantity * applications;
  }, 0);
  let allocatedCents = 0;

  requiredEntries.forEach(([productId, quantity], index) => {
    const line = linesByProductId.get(productId);
    if (!line) return;

    const requiredQuantity = quantity * applications;
    const baseShareCents = moneyToCents(line.product.price) * requiredQuantity;
    const lineShareCents =
      index === requiredEntries.length - 1
        ? totalPromotionCents - allocatedCents
        : Math.floor(totalPromotionCents * (baseTotalCents > 0 ? baseShareCents / baseTotalCents : 1 / requiredEntries.length));

    allocatedCents += lineShareCents;
    line.lineTotalCents += lineShareCents;
    line.remaining -= requiredQuantity;
    line.sources.add(source);
  });
}

function promotionRequirements(promotion: PromotionForPricing) {
  const requirements = new Map<string, number>();

  for (const item of promotion.items) {
    requirements.set(item.productId, (requirements.get(item.productId) ?? 0) + Math.max(item.quantity, 1));
  }

  return requirements;
}

function maxPromotionApplications(requirements: Map<string, number>, linesByProductId: Map<string, WorkingLine>) {
  const possibleApplications = [...requirements.entries()].map(([productId, requiredQuantity]) => {
    const line = linesByProductId.get(productId);
    return line ? Math.floor(line.remaining / requiredQuantity) : 0;
  });

  return Math.min(...possibleApplications, Number.MAX_SAFE_INTEGER);
}

function isPromotionActive(promotion: PromotionForPricing, at: Date) {
  if (!promotion.active || promotion.promotionalStock <= 0) return false;
  if (promotion.startsAt && promotion.startsAt > at) return false;
  if (promotion.endsAt && promotion.endsAt < at) return false;
  return true;
}

function comparePromotions(left: PromotionForPricing, right: PromotionForPricing) {
  const priority = priorityRank(left.priority) - priorityRank(right.priority);
  if (priority !== 0) return priority;

  const price = moneyToCents(left.promotionalPrice) - moneyToCents(right.promotionalPrice);
  if (price !== 0) return price;

  return left.name.localeCompare(right.name);
}

function priorityRank(priority: PromotionForPricing["priority"]) {
  return {
    FEATURED: 0,
    NORMAL: 1,
    SECONDARY: 2
  }[priority];
}

function quantityPriceCents(product: ProductForPricing, quantity: number) {
  const range = product.quantityPrices?.find((entry) => quantity >= entry.from && (entry.to === null || quantity <= entry.to));
  return range ? moneyToCents(range.price) : null;
}

function moneyToCents(value: unknown) {
  return Math.round(toMoney(value) * 100);
}

function centsToMoney(cents: number) {
  return roundMoney(cents / 100);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMoney(value: unknown) {
  return Number(value ?? 0);
}
