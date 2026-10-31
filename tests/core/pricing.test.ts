import { describe, expect, it } from "vitest";
import type {
  DiscountRule,
  ProductRef,
  TaxRule,
  VariantRef,
} from "@/contracts";
import { priceDocument } from "@/core/pricing";

const tax18: TaxRule = { id: "tax-18", name: "GST 18%", rateBp: 1800 };
const erp: ProductRef = {
  id: "prod-erp",
  name: "Brightloop ERP",
  salesPrice: 100_000, // ₹1,000
  taxId: "tax-18",
};
const odoo: VariantRef = {
  id: "var-odoo",
  attribute: "Brand",
  value: "Odoo",
  extraPrice: 56_000, // +₹560
};

function discount(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: "disc-1",
    name: "Test discount",
    type: "percent",
    value: 1000,
    scope: "products",
    productIds: ["prod-erp"],
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

const asOf = "2026-10-31";

describe("pricing", () => {
  it("adds the variant price to the product price", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [],
      asOf,
    });

    expect(doc.lines[0].unitPrice).toBe(156_000); // 1000 + 560
    expect(doc.lines[0].taxAmount).toBe(28_080); // 18% of 1560
    expect(doc.total).toBe(184_080);
  });

  it("multiplies by quantity", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 2 }],
      taxes: [tax18],
      discounts: [],
      asOf,
    });

    expect(doc.lines[0].gross).toBe(312_000);
    expect(doc.lines[0].taxAmount).toBe(56_160);
    expect(doc.total).toBe(368_160);
  });

  it("applies a product discount before tax", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [discount()],
      asOf,
    });

    expect(doc.discountTotal).toBe(15_600);
    expect(doc.lines[0].taxableAmount).toBe(140_400);
    expect(doc.lines[0].taxAmount).toBe(25_272);
    expect(doc.total).toBe(165_672);
  });

  it("caps a fixed discount at the line amount", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [discount({ type: "fixed", value: 500_000 })],
      asOf,
    });

    expect(doc.discountTotal).toBe(156_000);
    expect(doc.lines[0].taxableAmount).toBe(0);
    expect(doc.total).toBe(0);
  });

  it("spreads a subscription discount across the lines", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [discount({ scope: "subscription" })],
      asOf,
    });

    expect(doc.discountTotal).toBe(15_600);
    expect(doc.total).toBe(165_672);
  });

  it("keeps the bigger of two product discounts", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [discount({ id: "ten", value: 1000 }), discount({ id: "twenty", value: 2000 })],
      asOf,
    });

    expect(doc.discountTotal).toBe(31_200);
    expect(doc.appliedDiscounts).toEqual([{ discountId: "twenty", amount: 31_200 }]);
    expect(doc.total).toBe(147_264);
  });

  it("ignores an expired discount", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1 }],
      taxes: [tax18],
      discounts: [discount({ endsAt: "2026-10-01" })],
      asOf,
    });

    expect(doc.discountTotal).toBe(0);
    expect(doc.total).toBe(184_080);
  });

  it("charges no tax when the product has no tax rule", () => {
    const doc = priceDocument({
      lines: [{ product: { ...erp, taxId: null }, quantity: 1 }],
      taxes: [tax18],
      discounts: [],
      asOf,
    });

    expect(doc.lines[0].taxAmount).toBe(0);
    expect(doc.total).toBe(100_000);
  });

  it("uses a negotiated unit price instead of the catalogue price", () => {
    const doc = priceDocument({
      lines: [{ product: erp, variant: odoo, quantity: 1, unitPriceOverride: 200_000 }],
      taxes: [tax18],
      discounts: [],
      asOf,
    });

    expect(doc.lines[0].unitPrice).toBe(200_000);
    expect(doc.total).toBe(236_000);
  });

  it("adds up several lines", () => {
    const addon: ProductRef = { id: "prod-addon", name: "Backup add-on", salesPrice: 20_000, taxId: "tax-18" };
    const doc = priceDocument({
      lines: [
        { product: erp, variant: odoo, quantity: 1 },
        { product: addon, quantity: 2 },
      ],
      taxes: [tax18],
      discounts: [],
      asOf,
    });

    expect(doc.subtotal).toBe(196_000);
    expect(doc.total).toBe(231_280); // (1560 + 400) × 1.18
  });
});
