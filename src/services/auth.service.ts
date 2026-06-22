import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signToken } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(120)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(1).max(120)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(32).max(256)
});

const refreshTokenDays = 30;

async function toAuthResponse(user: { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" }) {
  return {
    token: signToken({ sub: user.id, email: user.email, role: user.role }),
    refreshToken: await createRefreshToken(user.id),
    user
  };
}

export async function register(input: unknown) {
  const data = registerSchema.parse(input);
  const email = data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email,
      passwordHash
    },
    select: { id: true, name: true, email: true, role: true }
  });

  return toAuthResponse(user);
}

export async function login(input: unknown) {
  const data = loginSchema.parse(input);
  const email = data.email.toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  if (!validPassword) {
    throw new HttpError(401, "Invalid credentials");
  }

  return toAuthResponse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });
}

export async function refresh(input: unknown) {
  const data = refreshTokenSchema.parse(input);
  const tokenHash = hashToken(data.refreshToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true }
      }
    }
  });

  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
    throw new HttpError(401, "Invalid refresh token");
  }

  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() }
    });

    const refreshToken = generateRefreshToken();
    await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiry()
      }
    });

    return {
      token: signToken({ sub: existing.user.id, email: existing.user.email, role: existing.user.role }),
      refreshToken,
      user: existing.user
    };
  });
}

export async function logout(input: unknown) {
  const data = refreshTokenSchema.parse(input);
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(data.refreshToken),
      revokedAt: null
    },
    data: { revokedAt: new Date() }
  });
}

async function createRefreshToken(userId: string) {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry()
    }
  });
  return refreshToken;
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiry() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + refreshTokenDays);
  return expiresAt;
}
