import type {
  DiscountRule,
  Paise,
  PriceInput,
  PricedDoc,
  PricedLine,
} from "@/contracts";
import { allocateProRata, roundHalfUp } from "./money";
import { bestDiscount, isDiscountEligible, type AppliedDiscount } from "./discount";

/**
 * The one pricing function. Quotes, billing previews and invoices all call it,
 * so the customer sees the same number everywhere.
 *
 * Order of operations:
 *   unit price  = catalogue price + variant extra (or a negotiated override)
 *   gross       = unit price × quantity
 *   line disc.  = best product-scope discount, capped at the gross
 *   order disc.  = best subscription-scope discount, spread across the lines
 *   tax         = on what is left, per line, rounded half up
 */
export function priceDocument(input: PriceInput): PricedDoc {
  const warnings: string[] = [];
  const redemptions = input.customerRedemptions ?? {};

  const base = input.lines.map((line) => {
    const unitPrice =
      line.unitPriceOverride ?? line.product.salesPrice + (line.variant?.extraPrice ?? 0);
    return {
      line,
      unitPrice,
      gross: unitPrice * line.quantity,
      discount: null as AppliedDiscount | null,
    };
  });

  // product-scope discounts are judged on the line they apply to
  for (const row of base) {
    const candidates = input.discounts.filter(
      (rule) =>
        rule.scope === "products" &&
        rule.productIds.includes(row.line.product.id) &&
        isDiscountEligible(rule, {
          asOf: input.asOf,
          subtotal: row.gross,
          quantity: row.line.quantity,
          customerRedemptions: redemptions,
        }),
    );
    row.discount = bestDiscount(candidates, row.gross);
  }

  const afterLineDiscounts = base.reduce(
    (sum, row) => sum + row.gross - (row.discount?.amount ?? 0),
    0,
  );
  const totalQuantity = base.reduce((sum, row) => sum + row.line.quantity, 0);

  const orderCandidates: DiscountRule[] = input.discounts.filter(
    (rule) =>
      rule.scope === "subscription" &&
      isDiscountEligible(rule, {
        asOf: input.asOf,
        subtotal: afterLineDiscounts,
        quantity: totalQuantity,
        customerRedemptions: redemptions,
      }),
  );
  const orderDiscount = bestDiscount(orderCandidates, afterLineDiscounts);
  const orderAllocation = orderDiscount
    ? allocateProRata(
        orderDiscount.amount,
        base.map((row) => row.gross - (row.discount?.amount ?? 0)),
      )
    : base.map(() => 0);

  const taxById = new Map(input.taxes.map((tax) => [tax.id, tax]));
  const applied = new Map<string, Paise>();

  const lines: PricedLine[] = base.map((row, index) => {
    const lineDiscount = row.discount?.amount ?? 0;
    const allocated = orderAllocation[index];
    const taxableAmount = Math.max(0, row.gross - lineDiscount - allocated);

    const taxRule = row.line.product.taxId
      ? taxById.get(row.line.product.taxId)
      : undefined;
    const taxRateBp = taxRule?.rateBp ?? 0;
    if (row.line.product.taxId && !taxRule) {
      warnings.push(`unknown tax ${row.line.product.taxId} on ${row.line.product.name}`);
    }
    const taxAmount = roundHalfUp((taxableAmount * taxRateBp) / 10_000);

    if (row.discount) {
      applied.set(
        row.discount.discount.id,
        (applied.get(row.discount.discount.id) ?? 0) + lineDiscount,
      );
    }
    if (orderDiscount) {
      applied.set(
        orderDiscount.discount.id,
        (applied.get(orderDiscount.discount.id) ?? 0) + allocated,
      );
    }

    const discountIds: string[] = [];
    if (row.discount) discountIds.push(row.discount.discount.id);
    if (orderDiscount) discountIds.push(orderDiscount.discount.id);

    return {
      productId: row.line.product.id,
      description: row.line.variant
        ? `${row.line.product.name} (${row.line.variant.attribute}: ${row.line.variant.value})`
        : row.line.product.name,
      quantity: row.line.quantity,
      unitPrice: row.unitPrice,
      gross: row.gross,
      discountAmount: lineDiscount + allocated,
      appliedDiscountIds: discountIds,
      taxableAmount,
      taxRateBp,
      taxAmount,
      lineTotal: taxableAmount + taxAmount,
    };
  });

  const subtotal = base.reduce((sum, row) => sum + row.gross, 0);
  const discountTotal = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const taxTotal = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  return {
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    appliedDiscounts: [...applied.entries()].map(([discountId, amount]) => ({
      discountId,
      amount,
    })),
    warnings,
  };
}
