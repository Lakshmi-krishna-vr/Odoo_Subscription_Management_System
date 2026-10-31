"use client";

import { useActionState } from "react";
import { transitionAction, type QuotationState } from "../actions";
import type { SubEvent } from "@/contracts";

const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff] disabled:opacity-60";

export interface AllowedMove {
  event: SubEvent;
  label: string;
  primary?: boolean;
}

export function TransitionForm({
  subscriptionId,
  moves,
}: {
  subscriptionId: string;
  moves: AllowedMove[];
}) {
  const [state, action, pending] = useActionState<QuotationState, FormData>(
    transitionAction,
    {},
  );

  if (moves.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        This subscription has no further moves — the plan does not allow them.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />

      <div className="flex flex-wrap gap-2">
        {moves.map((move) => (
          <button
            key={move.event}
            type="submit"
            name="event"
            value={move.event}
            disabled={pending}
            className={move.primary ? PRIMARY : SECONDARY}
          >
            {move.label}
          </button>
        ))}
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
