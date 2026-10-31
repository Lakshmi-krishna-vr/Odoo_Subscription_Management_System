"use client";

import { useActionState } from "react";
import {
  commitAction,
  confirmAction,
  previewAction,
  type BillingActionState,
} from "./actions";

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff] disabled:opacity-60";

function inr(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / 100).toString();
  const fraction = (Math.abs(paise) % 100).toString().padStart(2, "0");
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}` : last3;
  return `${paise < 0 ? "-" : ""}₹${grouped}.${fraction}`;
}

function Result({ state }: { state: BillingActionState }) {
  if (state.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
    );
  }
  if (!state.message) return null;

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        {state.message}
        {typeof state.totalValue === "number" && state.totalValue > 0 ? (
          <> Total value {inr(state.totalValue)}.</>
        ) : null}
      </p>

      {state.preview && state.preview.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <table>
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Customer</th>
                <th className="num">Invoice total</th>
              </tr>
            </thead>
            <tbody>
              {state.preview.map((row) => (
                <tr key={row.subscriptionNumber}>
                  <td className="font-mono text-xs">{row.subscriptionNumber}</td>
                  <td>{row.customer}</td>
                  <td className="num">{inr(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[11px] text-[var(--muted)]">
            Showing the first {state.preview.length} of {state.considered} due subscriptions.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BillingPanel({ today }: { today: string }) {
  const [preview, previewRun, previewing] = useActionState<BillingActionState, FormData>(
    previewAction,
    {},
  );
  const [commit, commitRun, committing] = useActionState<BillingActionState, FormData>(
    commitAction,
    {},
  );
  const [confirm, confirmRun, confirming] = useActionState<BillingActionState, FormData>(
    confirmAction,
    {},
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border)] bg-white p-5">
        <label className="block text-xs font-medium text-[var(--muted)]" htmlFor="asOf">
          Billing date
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <form action={previewRun} className="flex items-center gap-2">
            <input id="asOf" name="asOf" type="date" defaultValue={today} className={INPUT} />
            <button type="submit" className={SECONDARY} disabled={previewing}>
              {previewing ? "Checking…" : "Preview"}
            </button>
          </form>

          <form action={commitRun} className="flex items-center gap-2">
            <input type="hidden" name="asOf" value={today} />
            <button type="submit" className={PRIMARY} disabled={committing}>
              {committing ? "Running…" : "Run billing"}
            </button>
          </form>

          <form action={confirmRun}>
            <button type="submit" className={SECONDARY} disabled={confirming}>
              {confirming ? "Confirming…" : "Confirm all drafts"}
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Preview writes nothing. Run billing creates one draft invoice per subscription that is due,
          and running it again for the same date creates none — the database refuses a second invoice
          for the same subscription and period.
        </p>
      </div>

      <Result state={preview} />
      <Result state={commit} />
      <Result state={confirm} />
    </div>
  );
}
