-- Migrate existing product-level promotional prices into real individual promotions.
INSERT INTO "Promotion" (
    "id",
    "name",
    "startsAt",
    "endsAt",
    "promotionalPrice",
    "promotionalStock",
    "active",
    "priority",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_product_promo_' || "Product"."id",
    'Promo ' || "Product"."name",
    NULL,
    NULL,
    "Product"."promotionalPrice",
    GREATEST("Product"."stock", 1),
    true,
    'NORMAL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "Product"."promotionalPrice" IS NOT NULL;

INSERT INTO "PromotionItem" (
    "id",
    "promotionId",
    "productId",
    "quantity",
    "createdAt"
)
SELECT
    'legacy_product_promo_item_' || "Product"."id",
    'legacy_product_promo_' || "Product"."id",
    "Product"."id",
    1,
    CURRENT_TIMESTAMP
FROM "Product"
WHERE "Product"."promotionalPrice" IS NOT NULL;

ALTER TABLE "Product" DROP COLUMN "promotionalPrice";
