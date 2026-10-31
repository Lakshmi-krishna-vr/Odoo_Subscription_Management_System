"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/server/auth";

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
