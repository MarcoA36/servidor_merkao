-- CreateEnum
CREATE TYPE "PromotionPriority" AS ENUM ('FEATURED', 'NORMAL', 'SECONDARY');

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "departmentId" TEXT,
ADD COLUMN "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityPriceRange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "from" INTEGER NOT NULL,
    "to" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuantityPriceRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "promotionalPrice" DECIMAL(10,2) NOT NULL,
    "promotionalStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" "PromotionPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionItem" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_name_key" ON "Department"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Department_slug_key" ON "Department"("slug");

-- CreateIndex
CREATE INDEX "Category_departmentId_idx" ON "Category"("departmentId");

-- CreateIndex
CREATE INDEX "QuantityPriceRange_productId_idx" ON "QuantityPriceRange"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "QuantityPriceRange_productId_from_key" ON "QuantityPriceRange"("productId", "from");

-- CreateIndex
CREATE INDEX "Promotion_active_priority_idx" ON "Promotion"("active", "priority");

-- CreateIndex
CREATE INDEX "Promotion_startsAt_endsAt_idx" ON "Promotion"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PromotionItem_promotionId_idx" ON "PromotionItem"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionItem_productId_idx" ON "PromotionItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionItem_promotionId_productId_key" ON "PromotionItem"("promotionId", "productId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuantityPriceRange" ADD CONSTRAINT "QuantityPriceRange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionItem" ADD CONSTRAINT "PromotionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
