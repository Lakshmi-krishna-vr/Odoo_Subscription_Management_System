import type { InvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { todayIso } from "@/core/periods";
import { deriveInvoiceStatus } from "@/core/state";

const COUNTER_KEY = "INV-2026";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};
const SENDABLE_STATUSES: InvoiceStatus[] = ["confirmed", "partially_paid", "paid", "overdue"];

export function invoiceDisplayStatus(
  invoice: {
    status: InvoiceStatus;
    number: string | null;
    total: number;
    amountPaid: number;
    dueDate: Date;
  },
  today: string = todayIso(),
): InvoiceStatus {
  return deriveInvoiceStatus({
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate.toISOString().slice(0, 10),
    today,
    confirmed: invoice.number !== null,
    cancelled: invoice.status === "cancelled",
  });
}

export function displayStatusWhere(
  status: InvoiceStatus,
  today: string = todayIso(),
): Prisma.InvoiceWhereInput {
  const todayDate = new Date(`${today}T00:00:00Z`);
  const total = prisma.invoice.fields.total;
  const numbered: Prisma.InvoiceWhereInput = {
    status: { not: "cancelled" },
    number: { not: null },
  };

  switch (status) {
    case "cancelled":
      return { status: "cancelled" };
    case "draft":
      return { status: { not: "cancelled" }, number: null };
    case "paid":
      return { ...numbered, amountPaid: { gte: total } };
    case "partially_paid":
      return { ...numbered, amountPaid: { gt: 0, lt: total } };
    case "overdue":
      return { ...numbered, amountPaid: { equals: 0, lt: total }, dueDate: { lt: todayDate } };
    case "confirmed":
      return { ...numbered, amountPaid: { equals: 0, lt: total }, dueDate: { gte: todayDate } };
  }
}

export async function confirmInvoice(invoiceId: string): Promise<{ number: string }> {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true, number: true },
    });
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.number) throw new Error(`This invoice is already confirmed as ${invoice.number}.`);
    if (invoice.status !== "draft") throw new Error("Only a draft invoice can be confirmed.");

    const counter = await tx.counter.upsert({
      where: { key: COUNTER_KEY },
      create: { key: COUNTER_KEY, lastNo: 1 },
      update: { lastNo: { increment: 1 } },
    });
    const invoiceNumber = `${COUNTER_KEY}-${String(counter.lastNo).padStart(5, "0")}`;

    const confirmResult = await tx.invoice.updateMany({
      where: { id: invoiceId, status: "draft", number: null },
      data: { number: invoiceNumber, status: "confirmed" },
    });
    if (confirmResult.count === 0) {
      throw new Error("That invoice changed while you were confirming it. Reload and try again.");
    }

    return { number: invoiceNumber };
  });
}

export async function cancelInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, amountPaid: true },
  });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "cancelled") throw new Error("Already cancelled.");
  if (invoice.status === "paid" || invoice.amountPaid > 0) {
    throw new Error("An invoice with a payment recorded against it cannot be cancelled.");
  }

  const cancelResult = await prisma.invoice.updateMany({
    where: {
      id: invoiceId,
      amountPaid: 0,
      status: { in: ["draft", "confirmed", "overdue"] },
    },
    data: { status: "cancelled" },
  });
  if (cancelResult.count === 0) {
    throw new Error("That invoice changed while you were cancelling it. Reload and try again.");
  }
}

export async function sendInvoice(invoiceId: string): Promise<{ sentAt: Date }> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, number: true },
  });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "draft" || !invoice.number) {
    throw new Error("Confirm the invoice before sending it.");
  }
  if (invoice.status === "cancelled") throw new Error("A cancelled invoice cannot be sent.");

  const sentAt = new Date();
  const sendResult = await prisma.invoice.updateMany({
    where: { id: invoiceId, number: { not: null }, status: { in: SENDABLE_STATUSES } },
    data: { sentAt },
  });
  if (sendResult.count === 0) {
    throw new Error("That invoice changed while you were sending it. Reload and try again.");
  }

  return { sentAt };
}
