"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { hashSync } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { passwordProblem, requireRole } from "@/server/auth";

export interface StaffState {
  error?: string;
  message?: string;
}

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

/**
 * Only an admin may create a member of staff — the brief is explicit about it,
 * and the check is here rather than in the form, because a form can be bypassed.
 */
export async function createStaffAction(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const actor = await requireRole(["admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const rawEmail = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!name) return { error: "Enter the person's name." };

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  const email = parsed.data;

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with this email already exists." };

  await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      passwordHash: hashSync(password, 10),
      name,
      role: "staff",
      isActive: true,
    },
  });

  revalidatePath("/admin/staff");
  void actor;

  return { message: `${name} can now sign in as staff with ${email}.` };
}

export async function toggleStaffAction(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const actor = await requireRole(["admin"]);
  const userId = String(formData.get("userId") ?? "").trim();

  if (userId === actor.id) return { error: "You cannot deactivate your own account." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "That account no longer exists." };
  if (user.role === "admin") return { error: "Admin accounts cannot be deactivated here." };

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/admin/staff");
  return {
    message: `${user.name} is now ${user.isActive ? "deactivated" : "active"}.`,
  };
}
