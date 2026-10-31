import { randomUUID } from "node:crypto";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "@/server/db";
import { formatINR } from "@/core/money";
import { deriveInvoiceStatus, invoiceBalance } from "@/core/state";
import { todayIso } from "@/core/periods";

export interface RecordPaymentInput {
  invoiceId: string;
  amountPaise: number;
  method: PaymentMethod;
  paidAt: Date;
  note?: string | null;
  recordedBy: string;
}

export interface RecordPaymentResult {
  status: InvoiceStatus;
  amountPaid: number;
  balance: number;
}

/**
 * Record money received against an invoice.
 *
 * Everything that can go wrong with a payment is refused here rather than
 * reconciled later: zero or negative amounts, overpayment, cancelled invoices,
 * and invoices that were never confirmed (and so have no number).
 */
export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error("Enter an amount greater than zero.");
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        customerId: true,
        total: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        number: true,
      },
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "cancelled") throw new Error("This invoice is cancelled.");
    if (!invoice.number) throw new Error("Confirm the invoice before recording a payment.");

    const balance = invoiceBalance(invoice.total, invoice.amountPaid);
    if (input.amountPaise > balance) {
      throw new Error(`That is more than the balance of ${formatINR(balance)}.`);
    }

    await tx.payment.create({
      data: {
        id: randomUUID(),
        // the customer comes from the invoice, never from the form: a field
        // here would let a payment land against the wrong company
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        method: input.method,
        amount: input.amountPaise,
        paidAt: input.paidAt,
        note: input.note?.trim() || null,
        recordedBy: input.recordedBy,
      },
    });

    // increment, not an absolute write: two clerks recording at once would
    // otherwise lose one payment from amountPaid while both rows exist
    const after = await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: { increment: input.amountPaise } },
      select: { amountPaid: true, total: true, dueDate: true },
    });

    const status = deriveInvoiceStatus({
      total: after.total,
      amountPaid: after.amountPaid,
      confirmed: true,
      dueDate: after.dueDate.toISOString().slice(0, 10),
      today: todayIso(),
    });

    await tx.invoice.update({ where: { id: invoice.id }, data: { status } });

    return {
      status,
      amountPaid: after.amountPaid,
      balance: invoiceBalance(after.total, after.amountPaid),
    };
  });
}
