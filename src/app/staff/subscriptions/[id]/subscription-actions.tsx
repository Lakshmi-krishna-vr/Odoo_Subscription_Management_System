"use client";

import { useActionState, useState } from "react";
import type { SubEvent } from "@/contracts";
import { changeSubscriptionAction, type SubscriptionActionState } from "./actions";

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff] disabled:opacity-60";

const EVENT_LABEL: Record<SubEvent, string> = {
  send_quote: "Send quotation",
  confirm: "Confirm",
  activate: "Activate",
  pause: "Pause",
  resume: "Resume",
  renew: "Renew",
  close: "Close",
};

const PENDING_LABEL: Record<SubEvent, string> = {
  send_quote: "Sending…",
  confirm: "Confirming…",
  activate: "Activating…",
  pause: "Pausing…",
  resume: "Resuming…",
  renew: "Renewing…",
  close: "Closing…",
};

const PRIMARY_EVENTS: SubEvent[] = ["send_quote", "confirm", "activate", "resume"];

function Result({ state }: { state: SubscriptionActionState }) {
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

export function SubscriptionActions({
  subscriptionId,
  allowedEvents,
}: {
  subscriptionId: string;
  allowedEvents: SubEvent[];
}) {
  const [changeState, changeRun, changing] = useActionState<SubscriptionActionState, FormData>(
    changeSubscriptionAction,
    {},
  );
  const [isClosing, setIsClosing] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<SubEvent | null>(null);

  const buttonEvents = allowedEvents.filter((event) => event !== "close");
  const canClose = allowedEvents.includes("close");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {buttonEvents.map((event) => (
          <form key={event} action={changeRun} onSubmit={() => setPendingEvent(event)}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <input type="hidden" name="event" value={event} />
            <button
              type="submit"
              className={PRIMARY_EVENTS.includes(event) ? PRIMARY : SECONDARY}
              disabled={changing}
            >
              {changing && pendingEvent === event ? PENDING_LABEL[event] : EVENT_LABEL[event]}
            </button>
          </form>
        ))}

        {canClose && !isClosing ? (
          <button type="button" className={SECONDARY} onClick={() => setIsClosing(true)}>
            {EVENT_LABEL.close}
          </button>
        ) : null}
      </div>

      {canClose && isClosing ? (
        <form action={changeRun} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <input type="hidden" name="event" value="close" />
          <input
            name="reason"
            required
            placeholder="Reason for closing"
            className={INPUT}
          />
          <button type="submit" className={SECONDARY} disabled={changing}>
            {changing ? "Closing…" : "Close subscription"}
          </button>
          <button type="button" className={SECONDARY} onClick={() => setIsClosing(false)}>
            Keep open
          </button>
        </form>
      ) : null}

      <Result state={changeState} />
    </div>
  );
}
