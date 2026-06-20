import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { effectiveProductPrice } from "./product.service.js";

export const checkoutSchema = z.object({
  addressId: z.string().min(1)
});

export const orderStatusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "ON_THE_WAY", "DELIVERED"])
});

const orderInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: { id: true, imageUrl: true, isActive: true }
      }
    }
  }
} as const;

const allowedTransitions = {
  PENDING: ["PREPARING"],
  PREPARING: ["ON_THE_WAY"],
  ON_THE_WAY: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: []
} as const;

function mapOrder(order: any) {
  return {
    ...order,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    items: order.items.map((item: any) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal)
    }))
  };
}

export async function checkout(userId: string, input: unknown) {
  const data = checkoutSchema.parse(input);
  const address = await prisma.address.findFirst({ where: { id: data.addressId, userId } });

  if (!address) {
    throw new HttpError(400, "Delivery address is required");
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          quantityPrices: { orderBy: { from: "asc" } }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  if (cartItems.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  for (const item of cartItems) {
    if (!item.product.isActive) {
      throw new HttpError(409, `${item.product.name} is no longer available`);
    }

    if (item.product.stock < item.quantity) {
      throw new HttpError(409, `Not enough stock for ${item.product.name}`);
    }
  }

  const subtotal = cartItems.reduce(
    (sum, item) => sum + effectiveProductPrice(item.product, item.quantity) * item.quantity,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    for (const item of cartItems) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, isActive: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } }
      });

      if (updated.count === 0) {
        throw new HttpError(409, `Not enough stock for ${item.product.name}`);
      }
    }

    const createdOrder = await tx.order.create({
      data: {
        userId,
        addressId: address.id,
        subtotal,
        total: subtotal,
        addressSnapshot: {
          label: address.label,
          recipientName: address.recipientName,
          street: address.street,
          city: address.city,
          province: address.province,
          postalCode: address.postalCode,
          phone: address.phone
        },
        items: {
          create: cartItems.map((item) => {
            const unitPrice = effectiveProductPrice(item.product, item.quantity);
            return {
              productId: item.productId,
              productName: item.product.name,
              brandName: item.product.brand.name,
              categoryName: item.product.category.name,
              unitPrice,
              quantity: item.quantity,
              lineTotal: unitPrice * item.quantity
            };
          })
        }
      },
      include: orderInclude
    });

    await tx.cartItem.deleteMany({ where: { userId } });
    return createdOrder;
  });

  return mapOrder(order);
}

export async function listMyOrders(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: orderInclude,
    orderBy: { createdAt: "desc" }
  });

  return orders.map(mapOrder);
}

export async function getMyOrder(userId: string, id: string) {
  const order = await prisma.order.findFirst({ where: { id, userId }, include: orderInclude });

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  return mapOrder(order);
}

export async function cancelMyOrder(userId: string, id: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, userId },
      include: {
        items: {
          select: {
            productId: true,
            quantity: true
          }
        }
      }
    });

    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    if (order.status !== "PENDING") {
      throw new HttpError(400, "Only pending orders can be cancelled");
    }

    for (const item of order.items) {
      if (!item.productId) continue;

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } }
      });
    }

    return tx.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        archivedAt: new Date()
      },
      include: orderInclude
    });
  });

  return mapOrder(updated);
}

export async function listAdminOrders(includeArchived: boolean) {
  const orders = await prisma.order.findMany({
    where: includeArchived ? undefined : { archivedAt: null },
    include: orderInclude,
    orderBy: { createdAt: "desc" }
  });

  return orders.map(mapOrder);
}

export async function getAdminOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  return mapOrder(order);
}

export async function updateOrderStatus(id: string, input: unknown) {
  const data = orderStatusSchema.parse(input);
  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  const nextStatuses = allowedTransitions[order.status];
  if (!nextStatuses.includes(data.status as never)) {
    throw new HttpError(400, "Invalid order status transition");
  }

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: data.status,
      archivedAt: data.status === "DELIVERED" ? new Date() : null
    },
    include: orderInclude
  });

  return mapOrder(updated);
}

export async function getOrderVoucherHtml(id: string) {
  const order = await getAdminOrder(id);
  const address = order.addressSnapshot as Record<string, string>;
  const rows = order.items
    .map(
      (item: any) => `
        <tr>
          <td><strong>${escapeHtml(item.productName)}</strong><span>${escapeHtml(item.brandName)} / ${escapeHtml(item.categoryName)}</span></td>
          <td>${item.quantity}</td>
          <td>$${formatMoney(item.unitPrice)}</td>
          <td>$${formatMoney(item.lineTotal)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Voucher ${escapeHtml(order.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 13px; margin: 0; padding: 24px; background: #fff; }
    .page { border: 2px solid #111; max-width: 760px; margin: 0 auto; padding: 20px; }
    header { border-bottom: 2px solid #111; display: flex; justify-content: space-between; gap: 16px; padding-bottom: 14px; margin-bottom: 18px; }
    h1 { font-size: 22px; margin: 0 0 6px; text-transform: uppercase; }
    h2 { border-bottom: 1px solid #111; font-size: 15px; margin: 18px 0 10px; padding-bottom: 6px; text-transform: uppercase; }
    p { margin: 4px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #111; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f1f1; font-size: 12px; text-transform: uppercase; }
    td span { color: #333; display: block; font-size: 12px; margin-top: 4px; }
    .total { font-size: 18px; font-weight: 700; margin-top: 16px; text-align: right; }
    .status { border: 1px solid #111; display: inline-block; font-weight: 700; padding: 6px 10px; text-transform: uppercase; }
    @media print { body { padding: 0; } .page { border-width: 1px; max-width: none; min-height: 100vh; } }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <section>
        <h1>Merkao</h1>
        <p>Voucher de paquete</p>
        <p>Pedido: <strong>${escapeHtml(order.id)}</strong></p>
        <p>Fecha: ${escapeHtml(new Date(order.createdAt).toLocaleString("es-AR"))}</p>
      </section>
      <section><p class="status">${escapeHtml(order.status)}</p></section>
    </header>
    <section>
      <h2>Datos de envio</h2>
      <p><strong>${escapeHtml(address.recipientName ?? "")}</strong></p>
      <p>${escapeHtml(address.street ?? "")}</p>
      <p>${escapeHtml(address.city ?? "")}, ${escapeHtml(address.province ?? "")} (${escapeHtml(address.postalCode ?? "")})</p>
      <p>Telefono: ${escapeHtml(address.phone ?? "")}</p>
    </section>
    <section>
      <h2>Productos</h2>
      <table><thead><tr><th>Articulo</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="total">Total: $${formatMoney(order.total)}</p>
    </section>
  </main>
</body>
</html>`;
}

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
