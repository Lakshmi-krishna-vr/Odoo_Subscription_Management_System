import type {
  DiscountRule,
  Paise,
  PlanPeriod,
  PricedDoc,
  TaxRule,
} from "@/contracts";
import { addDays, periodEnd } from "@/core/periods";
import { priceDocument } from "@/core/pricing";

export interface BillableSubscription {
  paymentTermsDays: number;
  plan: {
    billingPeriod: PlanPeriod;
    intervalCount: number;
  };
  lines: readonly {
    productId: string;
    unitPrice: Paise;
    taxId: string | null;
    quantity: number;
  }[];
}

export function priceSubscription(args: {
  subscription: BillableSubscription;
  taxRules: readonly TaxRule[];
  discountRules: readonly DiscountRule[];
  customerRedemptions: Record<string, number>;
  periodStart: string;
}): {
  startIso: string;
  endIso: string;
  dueIso: string;
  doc: PricedDoc;
} {
  const { subscription, periodStart } = args;
  const endIso = periodEnd(
    periodStart,
    subscription.plan.billingPeriod,
    subscription.plan.intervalCount,
    Number(periodStart.slice(8, 10)),
  );
  const lines = subscription.lines.map((line) => ({
    quantity: line.quantity,
    product: {
      id: line.productId,
      name: "Subscription charge",
      salesPrice: line.unitPrice,
      taxId: line.taxId,
    },
  }));
  const doc = priceDocument({
    lines,
    taxes: args.taxRules,
    discounts: args.discountRules,
    customerRedemptions: args.customerRedemptions,
    asOf: periodStart,
  });

  return {
    startIso: periodStart,
    endIso,
    dueIso: addDays(periodStart, subscription.paymentTermsDays),
    doc,
  };
}
