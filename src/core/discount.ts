import type { DiscountRule, Paise } from "@/contracts";
import { roundHalfUp } from "./money";

export interface EligibilityContext {
  /** ISO date the eligibility is judged on */
  asOf: string;
  /** the amount the rule is judged against (line gross, or document subtotal) */
  subtotal: Paise;
  /** quantity the rule is judged against */
  quantity: number;
  /** redemptions already used by this customer, keyed by discount id */
  customerRedemptions: Readonly<Record<string, number>>;
}

/**
 * Every condition the brief lists must pass:
 * active, inside the date window, under the usage limits, above the minimum
 * purchase and quantity.
 */
export function isDiscountEligible(
  rule: DiscountRule,
  ctx: EligibilityContext,
): boolean {
  if (!rule.isActive) return false;
  if (rule.startsAt !== null && ctx.asOf < rule.startsAt) return false;
  if (rule.endsAt !== null && ctx.asOf > rule.endsAt) return false;
  if (rule.usageLimit !== null && rule.usedCount >= rule.usageLimit) return false;

  const usedByCustomer = ctx.customerRedemptions[rule.id] ?? 0;
  if (rule.perCustomerLimit !== null && usedByCustomer >= rule.perCustomerLimit) {
    return false;
  }

  if (ctx.subtotal < rule.minPurchase) return false;
  if (ctx.quantity < rule.minQuantity) return false;

  return true;
}

/** The saving a rule gives on `base`, never more than the base itself. */
export function discountAmount(rule: DiscountRule, base: Paise): Paise {
  if (base <= 0) return 0;
  const raw =
    rule.type === "fixed" ? rule.value : roundHalfUp((base * rule.value) / 10_000);
  return Math.min(raw, base);
}

export interface AppliedDiscount {
  discount: DiscountRule;
  amount: Paise;
}

/**
 * At most one discount per level, and the customer gets the bigger saving.
 * Stacking two percentage rules is how invoices end up negative.
 */
export function bestDiscount(
  candidates: readonly DiscountRule[],
  base: Paise,
): AppliedDiscount | null {
  let best: AppliedDiscount | null = null;
  for (const discount of candidates) {
    const amount = discountAmount(discount, base);
    if (amount <= 0) continue;
    if (best === null || amount > best.amount) best = { discount, amount };
  }
  return best;
}
