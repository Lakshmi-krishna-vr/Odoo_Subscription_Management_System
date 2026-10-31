"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth";
import { createSubscriptionFromTemplate } from "@/server/subscriptions";

export interface NewSubscriptionState {
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function createSubscriptionAction(
  _previousState: NewSubscriptionState,
  formData: FormData,
): Promise<NewSubscriptionState> {
  await requireRole(["admin", "staff"]);
  const customerId = String(formData.get("customerId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const expiryText = String(formData.get("expiryDate") ?? "");

  if (!UUID.test(customerId)) return { error: "Choose a customer." };
  if (!UUID.test(templateId)) return { error: "Choose a quotation template." };
  if (!ISO_DATE.test(startDate)) return { error: "Enter a start date." };
  if (expiryText && !ISO_DATE.test(expiryText)) return { error: "Enter a valid expiry date." };

  let subscriptionId: string;
  try {
    const subscription = await createSubscriptionFromTemplate({
      customerId,
      templateId,
      startDate,
      expiryDate: expiryText || null,
    });
    subscriptionId = subscription.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The subscription was not created." };
  }

  revalidatePath("/staff/subscriptions");
  redirect(`/staff/subscriptions/${subscriptionId}`);
}
