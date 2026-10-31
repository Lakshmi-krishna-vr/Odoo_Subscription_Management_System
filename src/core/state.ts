import type {
  InvoiceStatus,
  Paise,
  PlanPolicy,
  SubEvent,
  SubStatus,
} from "@/contracts";

/** Every allowed move. Anything not listed here is rejected. */
export const SUB_TRANSITIONS: Readonly<
  Record<SubEvent, { from: readonly SubStatus[]; to: SubStatus }>
> = {
  send_quote: { from: ["draft"], to: "quotation" },
  confirm: { from: ["quotation"], to: "confirmed" },
  activate: { from: ["confirmed"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  resume: { from: ["paused"], to: "active" },
  renew: { from: ["active"], to: "active" },
  close: { from: ["active", "paused", "confirmed"], to: "closed" },
};

export function nextSubStatus(from: SubStatus, event: SubEvent): SubStatus | null {
  const transition = SUB_TRANSITIONS[event];
  return transition.from.includes(from) ? transition.to : null;
}

export interface TransitionCheck {
  ok: boolean;
  next?: SubStatus;
  reason?: string;
}

/**
 * Checks the transition table first, then the plan's switches — the admin
 * decides per plan whether a subscription can be closed early, paused or renewed.
 */
export function checkTransition(args: {
  from: SubStatus;
  event: SubEvent;
  plan: PlanPolicy;
}): TransitionCheck {
  const next = nextSubStatus(args.from, args.event);
  if (next === null) {
    return {
      ok: false,
      reason: `cannot ${args.event} a subscription that is ${args.from}`,
    };
  }

  if (args.event === "pause" && !args.plan.pausable) {
    return { ok: false, reason: "this plan cannot be paused" };
  }
  if (args.event === "renew" && !args.plan.renewable) {
    return { ok: false, reason: "this plan cannot be renewed" };
  }
  if (args.event === "close" && !args.plan.closable && !args.plan.autoClose) {
    return { ok: false, reason: "this plan cannot be closed early" };
  }

  return { ok: true, next };
}

export function invoiceBalance(total: Paise, amountPaid: Paise): Paise {
  return Math.max(0, total - amountPaid);
}

/**
 * Invoice status is derived from the money, never set by hand.
 * `overdue` depends on today's date, so it stays correct without a cron job.
 */
export function deriveInvoiceStatus(args: {
  total: Paise;
  amountPaid: Paise;
  dueDate: string;
  today: string;
  cancelled?: boolean;
  confirmed?: boolean;
}): InvoiceStatus {
  if (args.cancelled) return "cancelled";
  if (!args.confirmed) return "draft";
  if (args.amountPaid >= args.total) return "paid";
  if (args.amountPaid > 0) return "partially_paid";
  return args.dueDate < args.today ? "overdue" : "confirmed";
}
