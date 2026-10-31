"use server";

import { revalidatePath } from "next/cache";
import type { SubEvent } from "@/contracts";
import { requireRole } from "@/server/auth";
import {
  SUBSCRIPTION_EVENTS,
  changeSubscriptionStatus,
  updateSubscriptionLines,
  type LineChange,
} from "@/server/subscriptions";

export interface SubscriptionActionState {
  error?: string;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUCCESS_MESSAGE: Record<SubEvent, string> = {
  send_quote: "Quotation sent.",
  confirm: "Subscription confirmed.",
  activate: "Subscription activated.",
  pause: "Subscription paused.",
  resume: "Subscription resumed. The paused days will not be billed.",
  renew: "Subscription renewed for one more billing period.",
  close: "Subscription closed.",
};

function readEvent(formData: FormData): SubEvent | null {
  const eventText = String(formData.get("event") ?? "");
  return SUBSCRIPTION_EVENTS.find((event) => event === eventText) ?? null;
}

export async function changeSubscriptionAction(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  await requireRole(["admin", "staff"]);
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  if (!UUID.test(subscriptionId)) return { error: "Subscription not found." };
  const event = readEvent(formData);
  if (!event) return { error: "That change is not recognised." };
  const reason = String(formData.get("reason") ?? "");

  try {
    await changeSubscriptionStatus(subscriptionId, event, { reason });
    revalidatePath("/staff/subscriptions");
    revalidatePath(`/staff/subscriptions/${subscriptionId}`);
    return { message: SUCCESS_MESSAGE[event] };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "That change failed." };
  }
}

const LINE_CHANGE_MESSAGE: Record<LineChange["kind"], string> = {
  quantity: "Quantity saved.",
  remove: "Line removed.",
  add: "Line added.",
};

function readLineChange(formData: FormData): LineChange | null {
  const kind = String(formData.get("change") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const quantity = Number(String(formData.get("quantity") ?? ""));

  if (kind === "quantity" && UUID.test(lineId)) return { kind, lineId, quantity };
  if (kind === "remove" && UUID.test(lineId)) return { kind, lineId };
  if (kind === "add") {
    const productId = String(formData.get("productId") ?? "");
    const variantId = String(formData.get("variantId") ?? "");
    if (!UUID.test(productId)) return null;
    return { kind, productId, variantId: UUID.test(variantId) ? variantId : null, quantity };
  }
  return null;
}

export async function changeLinesAction(
  _previousState: SubscriptionActionState,
  formData: FormData,
): Promise<SubscriptionActionState> {
  await requireRole(["admin", "staff"]);
  const subscriptionId = String(formData.get("subscriptionId") ?? "").trim();
  if (!UUID.test(subscriptionId)) return { error: "Subscription not found." };
  const lineChange = readLineChange(formData);
  if (!lineChange) return { error: "Choose a product and a quantity." };

  try {
    await updateSubscriptionLines(subscriptionId, lineChange);
    revalidatePath(`/staff/subscriptions/${subscriptionId}`);
    return { message: LINE_CHANGE_MESSAGE[lineChange.kind] };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The lines were not changed." };
  }
}
