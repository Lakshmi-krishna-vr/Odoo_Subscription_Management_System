"use client";

import { useActionState } from "react";
import { createQuotationAction, type QuotationState } from "../actions";

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f5eff]";
const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";

export interface Option {
  id: string;
  label: string;
}

export function NewQuotationForm({
  customers,
  templates,
  today,
}: {
  customers: Option[];
  templates: Option[];
  today: string;
}) {
  const [state, action, pending] = useActionState<QuotationState, FormData>(
    createQuotationAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="customerId">
            Customer
          </label>
          <select id="customerId" name="customerId" className={INPUT} required>
            <option value="">Choose a customer…</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="templateId">
            Quotation template
          </label>
          <select id="templateId" name="templateId" className={INPUT} required>
            <option value="">Choose a template…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL} htmlFor="startDate">
            Start date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={today}
            className={INPUT}
            required
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1f5eff] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create quotation"}
      </button>
    </form>
  );
}
