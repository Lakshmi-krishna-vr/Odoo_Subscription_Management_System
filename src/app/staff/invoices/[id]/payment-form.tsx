"use client";

import { useActionState } from "react";
import { PaymentMethod } from "@prisma/client";
import { recordPaymentAction, type PaymentState } from "./payment-actions";

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";

export function PaymentForm({
  invoiceId,
  balance,
  disabled,
}: {
  invoiceId: string;
  balance: number;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<PaymentState, FormData>(
    recordPaymentAction,
    {},
  );

  if (disabled) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No payment can be recorded against this invoice.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="amount">
            Amount (₹)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={(balance / 100).toFixed(2)}
            className={INPUT}
            required
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="method">
            Method
          </label>
          <select id="method" name="method" className={INPUT} defaultValue={PaymentMethod.bank}>
            {Object.values(PaymentMethod).map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="paidAt">
            Received on
          </label>
          <input id="paidAt" name="paidAt" type="date" className={INPUT} />
        </div>
        <div>
          <label className={LABEL} htmlFor="note">
            Note
          </label>
          <input id="note" name="note" placeholder="Bank reference" className={INPUT} />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record payment"}
      </button>
    </form>
  );
}
