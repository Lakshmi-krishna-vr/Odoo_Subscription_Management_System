"use server";

import { revalidatePath } from "next/cache";
import { PaymentMethod } from "@prisma/client";
import { requireRole } from "@/server/auth";
import { recordPayment } from "@/server/payments";
import { rupeesToPaise } from "@/core/money";
import { todayIso } from "@/core/periods";

export interface PaymentState {
  error?: string;
  message?: string;
}

export async function recordPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const user = await requireRole(["admin", "staff"]);

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  if (!invoiceId) return { error: "Missing invoice." };

  const amountRupees = Number(String(formData.get("amount") ?? "").trim());
  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
    return { error: "Enter an amount greater than zero." };
  }

  const method = String(formData.get("method") ?? "") as PaymentMethod;
  if (!Object.values(PaymentMethod).includes(method)) {
    return { error: "Choose a payment method." };
  }

  const rawDate = String(formData.get("paidAt") ?? "").trim();
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? new Date(`${rawDate}T00:00:00Z`)
    : new Date(`${todayIso()}T00:00:00Z`);

  const note = String(formData.get("note") ?? "");

  try {
    const result = await recordPayment({
      invoiceId,
      amountPaise: rupeesToPaise(amountRupees),
      method,
      paidAt,
      note,
      recordedBy: user.id,
    });

    revalidatePath(`/staff/invoices/${invoiceId}`);
    revalidatePath("/staff/invoices");
    revalidatePath("/staff/finance");

    return {
      message: `Payment recorded. Invoice is now ${result.status.replace("_", " ")}.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not record the payment." };
  }
}
