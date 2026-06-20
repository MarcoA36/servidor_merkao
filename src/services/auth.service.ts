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

function toAuthResponse(user: { id: string; name: string; email: string; role: "CUSTOMER" | "ADMIN" }) {
  return {
    token: signToken({ sub: user.id, email: user.email, role: user.role }),
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
