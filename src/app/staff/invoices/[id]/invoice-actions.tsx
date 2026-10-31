"use client";

import { useActionState } from "react";
import type { InvoiceStatus } from "@prisma/client";
import { cancelInvoiceAction, confirmInvoiceAction, type InvoiceActionState } from "./actions";

const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff] disabled:opacity-60";

function Result({ state }: { state: InvoiceActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
    );
  }
  if (!state.message) return null;

  return (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{state.message}</p>
  );
}

export function InvoiceActions({
  invoiceId,
  status,
  amountPaid,
  number,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  amountPaid: number;
  number: string | null;
}) {
  const [confirm, confirmRun, confirming] = useActionState<InvoiceActionState, FormData>(
    confirmInvoiceAction,
    {},
  );
  const [cancel, cancelRun, cancelling] = useActionState<InvoiceActionState, FormData>(
    cancelInvoiceAction,
    {},
  );

  const canConfirm = status === "draft" && number === null;
  const canCancel = status !== "cancelled" && amountPaid === 0;

  return (
    <div className="no-print space-y-2">
      <div className="flex items-center gap-2">
        <form action={confirmRun}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button type="submit" className={PRIMARY} disabled={!canConfirm || confirming}>
            {confirming ? "Confirming…" : "Confirm"}
          </button>
        </form>

        <form action={cancelRun}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <button type="submit" className={SECONDARY} disabled={!canCancel || cancelling}>
            {cancelling ? "Cancelling…" : "Cancel invoice"}
          </button>
        </form>
      </div>

      <Result state={confirm} />
      <Result state={cancel} />
    </div>
  );
}
