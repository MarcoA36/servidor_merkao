import type { Prisma } from "@prisma/client";

export type InventoryMovementInput = {
  productId: string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "RESERVED" | "RELEASED";
  quantity: number;
  reason: string;
  orderId?: string | null;
  changedByUserId?: string | null;
};

export function recordInventoryMovement(tx: Prisma.TransactionClient, input: InventoryMovementInput) {
  return tx.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      orderId: input.orderId ?? null,
      changedByUserId: input.changedByUserId ?? null
    }
  });
}

export function stockAdjustmentQuantity(previousStock: number, nextStock: number) {
  return nextStock - previousStock;
}
