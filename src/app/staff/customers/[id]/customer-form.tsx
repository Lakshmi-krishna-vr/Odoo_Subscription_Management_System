"use client";

import { useActionState } from "react";
import { updateCustomerAction, type CustomerActionState } from "./actions";

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const LABEL = "block text-xs font-medium text-[var(--muted)]";

export function CustomerForm({
  customer,
}: {
  customer: {
    id: string;
    contactName: string;
    email: string;
    phone: string | null;
    address: string | null;
    paymentTermsDays: number;
  };
}) {
  const [saveState, saveRun, saving] = useActionState<CustomerActionState, FormData>(
    updateCustomerAction,
    {},
  );

  return (
    <form action={saveRun} className="space-y-4">
      <input type="hidden" name="customerId" value={customer.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          Contact name
          <input
            name="contactName"
            required
            defaultValue={customer.contactName}
            className={`mt-1 block w-full ${INPUT}`}
          />
        </label>
        <label className={LABEL}>
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={customer.email}
            className={`mt-1 block w-full ${INPUT}`}
          />
        </label>
        <label className={LABEL}>
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={customer.phone ?? ""}
            className={`mt-1 block w-full ${INPUT}`}
          />
        </label>
        <label className={LABEL}>
          Payment terms (days)
          <input
            name="paymentTermsDays"
            type="number"
            min={0}
            max={365}
            step={1}
            required
            defaultValue={customer.paymentTermsDays}
            className={`mt-1 block w-full ${INPUT}`}
          />
          <span className="mt-1 block font-normal">
            Applies to future invoices only. Invoices already issued keep their due dates.
          </span>
        </label>
        <label className={`${LABEL} sm:col-span-2`}>
          Address
          <textarea
            name="address"
            rows={2}
            defaultValue={customer.address ?? ""}
            className={`mt-1 block w-full ${INPUT}`}
          />
        </label>
      </div>

      {saveState.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{saveState.error}</p>
      ) : null}
      {saveState.message && !saveState.error ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {saveState.message}
        </p>
      ) : null}

      <button type="submit" className={PRIMARY} disabled={saving}>
        {saving ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
