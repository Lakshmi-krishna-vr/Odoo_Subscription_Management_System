"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth";
import { cancelInvoice, confirmInvoice, sendInvoice } from "@/server/invoices";

export interface InvoiceActionState {
  error?: string;
  message?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readInvoiceId(formData: FormData): string | null {
  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  return UUID.test(invoiceId) ? invoiceId : null;
}

function refreshInvoicePages(invoiceId: string): void {
  revalidatePath("/staff/invoices");
  revalidatePath(`/staff/invoices/${invoiceId}`);
}

export async function confirmInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireRole(["admin", "staff"]);
  const invoiceId = readInvoiceId(formData);
  if (!invoiceId) return { error: "Invoice not found." };

  try {
    const confirmResult = await confirmInvoice(invoiceId);
    refreshInvoicePages(invoiceId);
    return { message: `Invoice confirmed as ${confirmResult.number}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Confirm failed." };
  }
}

export async function cancelInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireRole(["admin", "staff"]);
  const invoiceId = readInvoiceId(formData);
  if (!invoiceId) return { error: "Invoice not found." };

  try {
    await cancelInvoice(invoiceId);
    refreshInvoicePages(invoiceId);
    return { message: "Invoice cancelled." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Cancel failed." };
  }
}

export async function sendInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  await requireRole(["admin", "staff"]);
  const invoiceId = readInvoiceId(formData);
  if (!invoiceId) return { error: "Invoice not found." };

  try {
    await sendInvoice(invoiceId);
    refreshInvoicePages(invoiceId);
    return { message: "Invoice marked as sent." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Send failed." };
  }
}
