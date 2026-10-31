import type { PlanPeriod } from "@/contracts";

function pad(value: number, width = 2): string {
  return value.toString().padStart(width, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIso(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/**
 * Add whole months, clamped to the end of the target month.
 *
 * `anchorDay` keeps the original billing day across short months:
 * 31 Jan → 28 Feb (clamped) → 31 Mar (anchor restored), not 28 Mar.
 */
export function addMonths(iso: string, months: number, anchorDay?: number): string {
  const { year, month, day } = parseIso(iso);
  const wantedDay = anchorDay ?? day;

  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

  return toIso(targetYear, targetMonth, Math.min(wantedDay, daysInTargetMonth));
}

/** The next date in the plan's cycle. */
export function advance(
  iso: string,
  period: PlanPeriod,
  count = 1,
  anchorDay?: number,
): string {
  switch (period) {
    case "day":
      return addDays(iso, count);
    case "week":
      return addDays(iso, 7 * count);
    case "month":
      return addMonths(iso, count, anchorDay);
    case "year":
      return addMonths(iso, 12 * count, anchorDay);
  }
}

/** End of a billing period, exclusive: [start, end). */
export function periodEnd(
  start: string,
  period: PlanPeriod,
  count = 1,
  anchorDay?: number,
): string {
  return advance(start, period, count, anchorDay);
}

export function daysBetween(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  const startMs = Date.UTC(a.year, a.month - 1, a.day);
  const endMs = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((endMs - startMs) / 86_400_000);
}

/** True when the subscription's billing date has arrived (or was missed). */
export function isDue(nextBillingDate: string, asOf: string): boolean {
  return nextBillingDate <= asOf;
}

/**
 * Today's date in the business timezone, not UTC.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date: in IST that is
 * yesterday until 05:30, so a 02:00 billing run would look at the wrong day and
 * create nothing. This is the only place "today" is decided.
 */
export function todayIso(
  timeZone = "Asia/Kolkata",
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
