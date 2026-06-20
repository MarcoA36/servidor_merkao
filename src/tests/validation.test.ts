import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "../services/auth.service.js";
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
        stock: 10,
        imageUrl: "https://example.com/product.png",
        categoryId: "cat_123",
        brandId: "brand_123"
      })
    ).not.toThrow();
  });
});
