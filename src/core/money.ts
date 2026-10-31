import type { Paise } from "@/contracts";

/** ₹ → paise, rounded to the nearest paise. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

/** Round half up. Banker's rounding is wrong for invoicing. */
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** ₹1,23,456.78 — Indian digit grouping (last three, then pairs). */
export function formatINR(paise: Paise): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100).toString();
  const fraction = (abs % 100).toString().padStart(2, "0");

  const lastThree = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`
    : lastThree;

  return `${negative ? "-" : ""}₹${grouped}.${fraction}`;
}

/**
 * Split `total` across `weights` so that the parts add up to exactly `total`.
 * Rounding leftovers go to the largest fractional parts.
 */
export function allocateProRata(total: Paise, weights: readonly number[]): Paise[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] += 1;
    remainder -= 1;
  }
  return out;
}
