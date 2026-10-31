"use client";

import { useActionState } from "react";
import { PLAN_PERIODS } from "@/contracts";
import { createPlanAction, type PlanState } from "../actions";

const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SELECT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const FIELD_ERR = "mt-1 text-xs text-red-600";

const PERIOD_LABEL: Record<(typeof PLAN_PERIODS)[number], string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

export function PlanForm() {
  const [state, dispatch, pending] = useActionState<PlanState, FormData>(createPlanAction, {});

  return (
    <form action={dispatch} className="space-y-5">
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}

      <div>
        <label htmlFor="plan-name" className={LABEL}>
          Plan name <span className="text-red-500">*</span>
        </label>
        <input
          id="plan-name"
          name="name"
          type="text"
          placeholder="e.g. ERP Monthly"
          autoComplete="off"
          className={INPUT}
        />
        {state.fieldErrors?.name ? <p className={FIELD_ERR}>{state.fieldErrors.name}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="plan-price" className={LABEL}>
            Price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            id="plan-price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={INPUT}
          />
          {state.fieldErrors?.price ? <p className={FIELD_ERR}>{state.fieldErrors.price}</p> : null}
        </div>
        <div>
          <label htmlFor="plan-period" className={LABEL}>
            Billing period <span className="text-red-500">*</span>
          </label>
          <select id="plan-period" name="billingPeriod" defaultValue="month" className={SELECT}>
            {PLAN_PERIODS.map((period) => (
              <option key={period} value={period}>
                {PERIOD_LABEL[period]}
              </option>
            ))}
          </select>
          {state.fieldErrors?.billingPeriod ? (
            <p className={FIELD_ERR}>{state.fieldErrors.billingPeriod}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="plan-interval" className={LABEL}>
            Interval count
          </label>
          <input
            id="plan-interval"
            name="intervalCount"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            className={INPUT}
          />
          {state.fieldErrors?.intervalCount ? (
            <p className={FIELD_ERR}>{state.fieldErrors.intervalCount}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="plan-min-qty" className={LABEL}>
            Minimum quantity
          </label>
          <input
            id="plan-min-qty"
            name="minQuantity"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            className={INPUT}
          />
          {state.fieldErrors?.minQuantity ? (
            <p className={FIELD_ERR}>{state.fieldErrors.minQuantity}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="plan-from" className={LABEL}>
            Available from
          </label>
          <input id="plan-from" name="availableFrom" type="date" className={INPUT} />
          {state.fieldErrors?.availableFrom ? (
            <p className={FIELD_ERR}>{state.fieldErrors.availableFrom}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="plan-to" className={LABEL}>
            Available to
          </label>
          <input id="plan-to" name="availableTo" type="date" className={INPUT} />
          {state.fieldErrors?.availableTo ? (
            <p className={FIELD_ERR}>{state.fieldErrors.availableTo}</p>
          ) : null}
        </div>
      </div>

      <fieldset className="rounded-lg border border-[var(--border)] p-4">
        <legend className="px-1 text-xs font-medium text-[var(--muted)]">Policies</legend>
        <p className="mb-3 text-[11px] text-[var(--muted)]">
          These switches control whether subscriptions on this plan can be paused, renewed or
          closed.
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              id="plan-auto-close"
              name="autoClose"
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
            />
            <label htmlFor="plan-auto-close" className="text-sm">
              Auto-close at expiry
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="plan-closable"
              name="closable"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
            />
            <label htmlFor="plan-closable" className="text-sm">
              Can be closed early
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="plan-pausable"
              name="pausable"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
            />
            <label htmlFor="plan-pausable" className="text-sm">
              Can be paused
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="plan-renewable"
              name="renewable"
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
            />
            <label htmlFor="plan-renewable" className="text-sm">
              Can be renewed
            </label>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <a
          href="/admin/plans"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to plans
        </a>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save plan"}
        </button>
      </div>
    </form>
  );
}
