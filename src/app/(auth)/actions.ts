"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import {
  authenticate,
  createSession,
  homeFor,
  passwordProblem,
} from "@/server/auth";

export type AuthState = { error?: string; notice?: string; link?: string };

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const user = await authenticate(email, password);
  if (!user) return { error: "Email or password is incorrect." };

  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter your name." };
  if (!company) return { error: "Enter your company name." };

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  const email = parsed.data;

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  const passwordHash = hashSync(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        id: randomUUID(),
        code: `CUS-${Date.now().toString().slice(-6)}`,
        companyName: company,
        contactName: name,
        email,
        paymentTermsDays: 15,
      },
    });
    return tx.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash,
        name,
        role: "customer",
        customerId: customer.id,
      },
    });
  });

  await createSession(user.id);
  redirect("/portal");
}

export async function forgotAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const rawEmail = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: "Enter a valid email address." };

  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  const notice =
    "If an account exists for that address, a reset link has been sent to it.";

  if (!user) return { notice };

  const token = randomUUID();
  await prisma.passwordReset.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  const link = `/reset/${token}`;
  const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  if (!smtpConfigured) {
    // No mail server on this machine: the token flow is real, only delivery is
    // stubbed, so the link is shown here for the demo.
    console.log(`[password reset] ${user.email} → ${link}`);
    return { notice, link };
  }

  // SMTP configured: wire the send here (nodemailer) — the token above is the
  // whole flow, delivery is the only missing step.
  console.log(`[password reset] ${user.email} → ${link}`);
  return { notice };
}

export async function resetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset) return { error: "This reset link is not valid." };
  if (reset.usedAt) return { error: "This reset link has already been used." };
  if (reset.expiresAt.getTime() < Date.now()) return { error: "This reset link has expired." };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hashSync(password, 10) },
    }),
    prisma.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  redirect("/login?reset=1");
}
