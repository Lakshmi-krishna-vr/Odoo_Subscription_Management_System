"use client";

import { useActionState, useState } from "react";
import { createSubscriptionAction, type NewSubscriptionState } from "./actions";

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";

export interface CustomerOption {
  id: string;
  companyName: string;
}

export interface TemplateOption {
  id: string;
  name: string;
  planName: string;
  lines: { id: string; productName: string; variantLabel: string | null; quantity: number }[];
}

export function NewSubscriptionForm({
  customers,
  templates,
  today,
}: {
  customers: CustomerOption[];
  templates: TemplateOption[];
  today: string;
}) {
  const [createState, createRun, creating] = useActionState<NewSubscriptionState, FormData>(
    createSubscriptionAction,
    {},
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const chosenTemplate = templates.find((template) => template.id === templateId);

  return (
    <form action={createRun} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-[var(--muted)]">
          Customer
          <select name="customerId" required defaultValue="" className={`mt-1 block w-full ${INPUT}`}>
            <option value="" disabled>
              Choose a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.companyName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-[var(--muted)]">
          Quotation template
          <select
            name="templateId"
            required
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className={`mt-1 block w-full ${INPUT}`}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} — {template.planName}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-[var(--muted)]">
          Start date
          <input
            name="startDate"
            type="date"
            required
            defaultValue={today}
            className={`mt-1 block w-full ${INPUT}`}
          />
        </label>

        <label className="block text-xs font-medium text-[var(--muted)]">
          Expiry date (optional)
          <input name="expiryDate" type="date" className={`mt-1 block w-full ${INPUT}`} />
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th className="num">Qty</th>
            </tr>
          </thead>
          <tbody>
            {!chosenTemplate || chosenTemplate.lines.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-[var(--muted)]">
                  This template has no lines.
                </td>
              </tr>
            ) : (
              chosenTemplate.lines.map((line) => (
                <tr key={line.id}>
                  <td>{line.productName}</td>
                  <td>{line.variantLabel ?? "—"}</td>
                  <td className="num">{line.quantity}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createState.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{createState.error}</p>
      ) : null}

      <button type="submit" className={PRIMARY} disabled={creating || templates.length === 0}>
        {creating ? "Creating…" : "Create subscription"}
      </button>
    </form>
  );
}
