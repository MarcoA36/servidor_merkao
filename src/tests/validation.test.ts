import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../services/auth.service.js";
import { promotionSchema } from "../services/admin-catalog.service.js";
import { productSchema } from "../services/product.service.js";

describe("request validation", () => {
  it("accepts a valid register payload", () => {
    expect(() =>
      registerSchema.parse({
        name: "Usuario Demo",
        email: "demo@merkao.local",
        password: "Demo1234"
      })
    ).not.toThrow();
  });

  it("rejects weak register payloads", () => {
    expect(() =>
      registerSchema.parse({
        name: "A",
        email: "not-an-email",
        password: "123"
      })
    ).toThrow();
  });

  it("accepts a valid login payload", () => {
    expect(() =>
      loginSchema.parse({
        email: "demo@merkao.local",
        password: "Demo1234"
      })
    ).not.toThrow();
  });

  it("accepts a valid product payload", () => {
    expect(() =>
      productSchema.parse({
        name: "Papas fritas",
        description: "Producto listo para publicar",
        price: 1200,
        promotionalPrice: 990,
        quantityPrices: [
          { from: 1, to: 5, price: 1200 },
          { from: 6, to: null, price: 990 }
        ],
        stock: 10,
        imageUrl: "https://example.com/product.png",
        categoryId: "cat_123",
        brandId: "brand_123"
      })
    ).not.toThrow();
  });

  it("accepts an admin promotion payload", () => {
    expect(() =>
      promotionSchema.parse({
        name: "Combo snacks",
        productIds: ["prod_1", "prod_2"],
        startsAt: "2026-06-19",
        endsAt: "2026-06-30",
        promotionalPrice: 3500,
        promotionalStock: 20,
        active: true,
        priority: "featured"
      })
    ).not.toThrow();
  });
});
