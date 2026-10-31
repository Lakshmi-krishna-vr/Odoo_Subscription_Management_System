"use server";

import { revalidatePath } from "next/cache";
import { confirmDraftInvoices, runBilling, todayIST, type BillingPreviewRow } from "@/server/billing";

export interface BillingActionState {
  error?: string;
  message?: string;
  considered?: number;
  created?: number;
  skipped?: number;
  totalValue?: number;
  preview?: BillingPreviewRow[];
}

function readAsOf(formData: FormData): string {
  const value = String(formData.get("asOf") ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayIST();
}

export async function previewAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const result = await runBilling(readAsOf(formData), { dryRun: true, triggeredBy: "ui" });
    revalidatePath("/staff/billing");
    return {
      message: `${result.considered} subscriptions are due. Nothing has been written yet.`,
      considered: result.considered,
      created: 0,
      skipped: 0,
      totalValue: result.totalValue,
      preview: result.preview.slice(0, 25),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "preview failed" };
  }
}

export async function commitAction(
  _prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  try {
    const result = await runBilling(readAsOf(formData), { dryRun: false, triggeredBy: "ui" });
    revalidatePath("/staff/billing");
    revalidatePath("/staff/invoices");
    return {
      message:
        result.created === 0
          ? `Nothing to create — ${result.skipped} already invoiced for this period.`
          : `${result.created} draft invoices created, ${result.skipped} skipped as already invoiced.`,
      considered: result.considered,
      created: result.created,
      skipped: result.skipped,
      totalValue: result.totalValue,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "billing run failed" };
  }
}

export async function confirmAction(
  _prev: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  try {
    const confirmed = await confirmDraftInvoices();
    revalidatePath("/staff/billing");
    revalidatePath("/staff/invoices");
    return {
      message:
        confirmed === 0
          ? "No draft invoices to confirm."
          : `${confirmed} draft invoices confirmed and numbered.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "confirm failed" };
  }
}
