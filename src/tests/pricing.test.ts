import { describe, expect, it } from "vitest";
import { calculateCartPricing, type PromotionForPricing } from "../services/pricing.service.js";

const now = new Date("2026-06-20T12:00:00.000Z");

describe("pricing service", () => {
  it("applies combo before individual promotion and quantity prices", () => {
    const cola = product("cola", 3000, [
      { from: 2, to: null, price: 2500 }
    ]);
    const chips = product("chips", 2000);

    const pricing = calculateCartPricing(
      [
        { product: cola, quantity: 2 },
        { product: chips, quantity: 1 }
      ],
      [
        promotion("combo", "Combo bebida + snacks", 4000, 10, [
          { productId: "cola", quantity: 1 },
          { productId: "chips", quantity: 1 }
        ]),
        promotion("cola-promo", "Promo cola", 2600, 10, [{ productId: "cola", quantity: 1 }])
      ],
      now
    );

    expect(pricing.total).toBe(6600);
    expect(pricing.lines).toEqual([
      expect.objectContaining({ productId: "cola", quantity: 2, lineTotal: 5000, unitPrice: 2500, pricingSource: "MIXED" }),
      expect.objectContaining({ productId: "chips", quantity: 1, lineTotal: 1600, unitPrice: 1600, pricingSource: "COMBO" })
    ]);
    expect(pricing.promotionUsages).toEqual([
      expect.objectContaining({ promotionId: "combo", quantity: 1, pricingSource: "COMBO" }),
      expect.objectContaining({ promotionId: "cola-promo", quantity: 1, pricingSource: "PROMOTION" })
    ]);
  });

  it("uses quantity price when no promotion applies", () => {
    const pricing = calculateCartPricing(
      [{ product: product("rice", 1000, [{ from: 6, to: null, price: 900 }]), quantity: 6 }],
      [],
      now
    );

    expect(pricing.total).toBe(5400);
    expect(pricing.lines[0]).toEqual(expect.objectContaining({ unitPrice: 900, pricingSource: "QUANTITY" }));
  });

  it("ignores inactive and out-of-stock promotions", () => {
    const pricing = calculateCartPricing(
      [{ product: product("tea", 1000), quantity: 1 }],
      [
        { ...promotion("inactive", "Inactive", 500, 10, [{ productId: "tea", quantity: 1 }]), active: false },
        promotion("empty", "Empty", 400, 0, [{ productId: "tea", quantity: 1 }])
      ],
      now
    );

    expect(pricing.total).toBe(1000);
    expect(pricing.lines[0]).toEqual(expect.objectContaining({ pricingSource: "BASE" }));
    expect(pricing.promotionUsages).toHaveLength(0);
  });
});

function product(
  id: string,
  price: number,
  quantityPrices: Array<{ from: number; to: number | null; price: number }> = []
) {
  return { id, price, quantityPrices };
}

function promotion(
  id: string,
  name: string,
  promotionalPrice: number,
  promotionalStock: number,
  items: Array<{ productId: string; quantity: number }>
) {
  return {
    id,
    name,
    startsAt: null,
    endsAt: null,
    promotionalPrice,
    promotionalStock,
    active: true,
    priority: "NORMAL",
    items
  } as unknown as PromotionForPricing;
}
