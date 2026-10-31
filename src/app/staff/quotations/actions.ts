"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import {
  createSubscriptionFromTemplate,
  transitionSubscription,
} from "@/server/subscriptions";
import type { SubEvent } from "@/contracts";

export interface QuotationState {
  error?: string;
  message?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function createQuotationAction(
  _prev: QuotationState,
  formData: FormData,
): Promise<QuotationState> {
  await requireRole(["admin", "staff"]);

  const customerId = String(formData.get("customerId") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();

  if (!customerId) return { error: "Choose a customer." };
  if (!templateId) return { error: "Choose a quotation template." };
  if (!DATE.test(startDate)) return { error: "Choose a start date." };

  try {
    const { subscription } = await createSubscriptionFromTemplate({
      customerId,
      templateId,
      startDate,
    });
    revalidatePath("/staff/quotations");
    redirect(`/staff/quotations/${subscription.id}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    // redirect() throws a control-flow error that must not be swallowed
    if (typeof error === "object" && error !== null && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "Could not create the quotation." };
  }
}

export async function transitionAction(
  _prev: QuotationState,
  formData: FormData,
): Promise<QuotationState> {
  await requireRole(["admin", "staff"]);

  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  const event = String(formData.get("event") ?? "").trim() as SubEvent;

  const allowed: SubEvent[] = ["send_quote", "confirm", "activate", "pause", "resume", "renew", "close"];
  if (!allowed.includes(event)) return { error: "Unknown action." };

  try {
    const result = await transitionSubscription(subscriptionId, event);
    revalidatePath("/staff/quotations");
    revalidatePath(`/staff/quotations/${subscriptionId}`);
    revalidatePath("/staff/subscriptions");
    return { message: result.message };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That move failed." };
  }
}
