import { describe, expect, it } from "vitest";
import type { DiscountRule } from "@/contracts";
import {
  bestDiscount,
  discountAmount,
  isDiscountEligible,
} from "@/core/discount";

function rule(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: "disc-1",
    name: "Test discount",
    type: "percent",
    value: 1000, // 10%
    scope: "products",
    productIds: ["prod-1"],
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

const ctx = {
  asOf: "2026-10-31",
  subtotal: 100_000,
  quantity: 2,
  customerRedemptions: {},
};

describe("discounts", () => {
  it("applies a percentage", () => {
    expect(discountAmount(rule(), 100_000)).toBe(10_000);
  });

  it("caps a fixed discount at the amount it applies to", () => {
    expect(discountAmount(rule({ type: "fixed", value: 50_000 }), 30_000)).toBe(30_000);
  });

  it("rejects a rule that has not started", () => {
    expect(isDiscountEligible(rule({ startsAt: "2026-11-01" }), ctx)).toBe(false);
  });

  it("rejects a rule that has expired", () => {
    expect(isDiscountEligible(rule({ endsAt: "2026-10-30" }), ctx)).toBe(false);
  });

  it("rejects a rule whose usage limit is reached", () => {
    expect(isDiscountEligible(rule({ usageLimit: 5, usedCount: 5 }), ctx)).toBe(false);
  });

  it("rejects a customer who used their allowance", () => {
    expect(
      isDiscountEligible(rule({ perCustomerLimit: 1 }), {
        ...ctx,
        customerRedemptions: { "disc-1": 1 },
      }),
    ).toBe(false);
  });

  it("rejects a basket below the minimum purchase", () => {
    expect(isDiscountEligible(rule({ minPurchase: 200_000 }), ctx)).toBe(false);
  });

  it("rejects a basket below the minimum quantity", () => {
    expect(isDiscountEligible(rule({ minQuantity: 3 }), ctx)).toBe(false);
  });

  it("rejects an inactive rule", () => {
    expect(isDiscountEligible(rule({ isActive: false }), ctx)).toBe(false);
  });

  it("keeps the bigger saving when two rules could apply", () => {
    const tenPercent = rule({ id: "ten", value: 1000 });
    const twentyPercent = rule({ id: "twenty", value: 2000 });
    const best = bestDiscount([tenPercent, twentyPercent], 100_000);
    expect(best?.discount.id).toBe("twenty");
    expect(best?.amount).toBe(20_000);
  });
});
