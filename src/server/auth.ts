import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";

const COOKIE_NAME = "bl_session";
const SESSION_DAYS = 7;

function secretKey(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET is missing or too short — set it in .env");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export type SessionUser = User & { customer: { id: string; companyName: string } | null };

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: { select: { id: true, companyName: true } } },
    });
    if (!user || !user.isActive) return null;
    return user;
  } catch {
    return null;
  }
}

export function homeFor(role: Role): string {
  if (role === "admin") return "/admin";
  if (role === "staff") return "/staff";
  return "/portal";
}

/**
 * Every protected page calls this. The UI hiding a link is not security; this
 * check runs on the server before anything is rendered.
 */
export async function requireRole(roles: readonly Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { customer: { select: { id: true, companyName: true } } },
  });
  if (!user || !user.isActive) return null;

  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return user;
}

/** more than eight characters, with an uppercase, a lowercase and a special character */
export const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

export const PASSWORD_HINT =
  "More than 8 characters, with an uppercase letter, a lowercase letter and a special character.";

export function passwordProblem(password: string): string | null {
  if (password.length === 0) return "Enter a password.";
  if (!PASSWORD_RULE.test(password)) return PASSWORD_HINT;
  return null;
}
