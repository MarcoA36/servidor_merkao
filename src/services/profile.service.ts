import { z } from "zod";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80)
});

export const addressSchema = z.object({
  label: z.string().trim().min(2).max(40),
  recipientName: z.string().trim().min(2).max(80),
  street: z.string().trim().min(4).max(160),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  phone: z.string().trim().min(6).max(40),
  isDefault: z.boolean().optional()
});

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  return user;
}

export async function updateProfile(userId: string, input: unknown) {
  const data = profileSchema.parse(input);
  return prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, role: true }
  });
}

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
  });
}

export async function createAddress(userId: string, input: unknown) {
  const data = addressSchema.parse(input);

  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    const shouldBeDefault = data.isDefault ?? existingCount === 0;

    if (shouldBeDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return tx.address.create({
      data: {
        ...data,
        isDefault: shouldBeDefault,
        userId
      }
    });
  });
}

export async function updateAddress(userId: string, id: string, input: unknown) {
  const data = addressSchema.parse(input);
  const existing = await prisma.address.findFirst({ where: { id, userId } });

  if (!existing) {
    throw new HttpError(404, "Address not found");
  }

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return tx.address.update({ where: { id }, data });
  });
}

export async function deleteAddress(userId: string, id: string) {
  const existing = await prisma.address.findFirst({ where: { id, userId } });

  if (!existing) {
    throw new HttpError(404, "Address not found");
  }

  await prisma.address.delete({ where: { id } });
}
