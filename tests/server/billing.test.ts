import { describe, expect, it } from "vitest";
import type { DiscountRule, PlanPeriod, TaxRule } from "@/contracts";
import type { BillableSubscription } from "@/server/price-subscription";
import { priceSubscription } from "@/server/price-subscription";

const taxRules: TaxRule[] = [{ id: "gst-18", name: "GST 18%", rateBp: 1800 }];

function subscription(overrides: Partial<BillableSubscription> = {}): BillableSubscription {
  return {
    paymentTermsDays: 0,
    plan: { billingPeriod: "month", intervalCount: 1 },
    lines: [{ productId: "erp", unitPrice: 100_000, taxId: "gst-18", quantity: 1 }],
    ...overrides,
  };
}

function discount(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: "discount",
    name: "Test discount",
    type: "fixed",
    value: 50_000,
    scope: "subscription",
    productIds: [],
    minPurchase: 0,
    minQuantity: 1,
    startsAt: null,
    endsAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    usedCount: 0,
    isActive: true,
    ...overrides,
  };
}

function price(args: {
  subscription?: BillableSubscription;
  discountRules?: readonly DiscountRule[];
  periodStart?: string;
}) {
  return priceSubscription({
    subscription: args.subscription ?? subscription(),
    taxRules,
    discountRules: args.discountRules ?? [],
    customerRedemptions: {},
    periodStart: args.periodStart ?? "2026-10-31",
  });
}

describe("priceSubscription", () => {
  it("calculates a 1,000 rupee ERP line with 18% tax in paise", () => {
    const { doc } = price({});

    expect(doc.subtotal).toBe(100_000);
    expect(doc.discountTotal).toBe(0);
    expect(doc.taxTotal).toBe(18_000);
    expect(doc.total).toBe(118_000);
  });

  it("applies the seeded fixed festive discount before tax", () => {
    const { doc } = price({
      discountRules: [
        discount({
          name: "Festive ₹500 off",
          minPurchase: 100_000,
          startsAt: "2026-10-01",
          endsAt: "2026-11-15",
        }),
      ],
    });

    expect(doc.subtotal).toBe(100_000);
    expect(doc.discountTotal).toBe(50_000);
    expect(doc.taxTotal).toBe(9_000);
    expect(doc.total).toBe(59_000);
  });

  it("only applies the seeded volume discount at quantity five", () => {
    const volumeDiscount = discount({
      type: "percent",
      value: 1000,
      scope: "products",
      productIds: ["erp"],
      minQuantity: 5,
    });

    const single = price({
      subscription: subscription({
        lines: [{ productId: "erp", unitPrice: 100_000, taxId: "gst-18", quantity: 1 }],
      }),
      discountRules: [volumeDiscount],
    }).doc;
    const volume = price({
      subscription: subscription({
        lines: [{ productId: "erp", unitPrice: 100_000, taxId: "gst-18", quantity: 5 }],
      }),
      discountRules: [volumeDiscount],
    }).doc;

    expect(single.discountTotal).toBe(0);
    expect(single.taxTotal).toBe(18_000);
    expect(single.total).toBe(118_000);
    expect(volume.subtotal).toBe(500_000);
    expect(volume.discountTotal).toBe(50_000);
    expect(volume.taxTotal).toBe(81_000);
    expect(volume.total).toBe(531_000);
  });

  it("does not apply an expired discount", () => {
    const { doc } = price({
      discountRules: [discount({ endsAt: "2026-10-01" })],
    });

    expect(doc.subtotal).toBe(100_000);
    expect(doc.discountTotal).toBe(0);
    expect(doc.taxTotal).toBe(18_000);
    expect(doc.total).toBe(118_000);
  });

  it("does not apply a discount when the customer or global redemption limit is exhausted", () => {
    const customerLimited = discount({ perCustomerLimit: 1 });
    const globallyLimited = discount({ id: "global", usageLimit: 5, usedCount: 5 });

    const customerResult = price({
      discountRules: [customerLimited],
    });
    const globalResult = price({
      discountRules: [globallyLimited],
    });
    const priorCustomerResult = priceSubscription({
      subscription: subscription(),
      taxRules,
      discountRules: [customerLimited],
      customerRedemptions: { [customerLimited.id]: 1 },
      periodStart: "2026-10-31",
    });

    expect(customerResult.doc.discountTotal).toBe(50_000);
    expect(globalResult.doc.discountTotal).toBe(0);
    expect(priorCustomerResult.doc.discountTotal).toBe(0);
  });

  it("calculates percentage discounts in integer paise", () => {
    const { doc } = price({
      discountRules: [discount({ type: "percent", value: 1250 })],
    });

    expect(doc.subtotal).toBe(100_000);
    expect(doc.discountTotal).toBe(12_500);
    expect(doc.taxTotal).toBe(15_750);
    expect(doc.total).toBe(103_250);
  });

  it.each([
    ["month", "2026-11-30"],
    ["year", "2027-10-31"],
    ["week", "2026-11-07"],
    ["day", "2026-11-01"],
  ] as const)("calculates the %s period end", (billingPeriod: PlanPeriod, expectedEnd) => {
    const result = price({
      subscription: subscription({
        plan: { billingPeriod, intervalCount: 1 },
      }),
    });

    expect(result.startIso).toBe("2026-10-31");
    expect(result.endIso).toBe(expectedEnd);
  });

  it.each([
    ["2026-01-31", "2026-02-28"],
    ["2026-03-31", "2026-04-30"],
  ])("clamps monthly periods to month end from %s", (periodStart, expectedEnd) => {
    expect(price({ periodStart }).endIso).toBe(expectedEnd);
  });

  it("calculates the due date from payment terms", () => {
    const result = price({
      subscription: subscription({ paymentTermsDays: 15 }),
    });

    expect(result.dueIso).toBe("2026-11-15");
  });

  it("does not charge tax when the subscription line has no tax ID", () => {
    const { doc } = price({
      subscription: subscription({
        lines: [{ productId: "erp", unitPrice: 100_000, taxId: null, quantity: 1 }],
      }),
    });

    expect(doc.subtotal).toBe(100_000);
    expect(doc.discountTotal).toBe(0);
    expect(doc.taxTotal).toBe(0);
    expect(doc.total).toBe(100_000);
  });
});
