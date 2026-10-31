import type { DiscountRule, ProductRef, TaxRule, VariantRef } from "@/contracts";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { priceDocument } from "@/core/pricing";

const tax18: TaxRule = { id: "tax-18", name: "GST 18%", rateBp: 1800 };

const erp: ProductRef = {
  id: "prod-erp",
  name: "Brightloop ERP",
  salesPrice: 100_000, // ₹1,000
  taxId: "tax-18",
};

const odooBrand: VariantRef = {
  id: "var-odoo",
  attribute: "Brand",
  value: "Odoo",
  extraPrice: 56_000, // +₹560
};

const volumeDiscount: DiscountRule = {
  id: "disc-volume",
  name: "10% volume",
  type: "percent",
  value: 1000, // 10%
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
};

export default function AdminPage() {
  // Real engine output, not mock data: this is the same function the billing run will call.
  const priced = priceDocument({
    lines: [{ product: erp, variant: odooBrand, quantity: 2 }],
    taxes: [tax18],
    discounts: [volumeDiscount],
    asOf: "2026-10-31",
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="Admin"
        subtitle="Configuration surface. Catalogue, plans and discount rules land here."
        right={<Badge>pricing preview</Badge>}
      />

      <Card
        title="Pricing preview"
        description="Brightloop ERP, Odoo brand (+₹560), quantity 2, 10% volume discount, 18% tax."
      >
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Taxable</th>
              <th className="num">Tax</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {priced.lines.map((line) => (
              <tr key={line.productId}>
                <td>{line.description}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{formatINR(line.unitPrice)}</td>
                <td className="num">{formatINR(line.discountAmount)}</td>
                <td className="num">{formatINR(line.taxableAmount)}</td>
                <td className="num">
                  {formatINR(line.taxAmount)}
                  <span className="ml-1 text-xs text-[var(--muted)]">
                    ({line.taxRateBp / 100}%)
                  </span>
                </td>
                <td className="num font-medium">{formatINR(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">Subtotal</dt>
            <dd className="tabular-nums">{formatINR(priced.subtotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Discount</dt>
            <dd className="tabular-nums">{formatINR(priced.discountTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Tax</dt>
            <dd className="tabular-nums">{formatINR(priced.taxTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Total</dt>
            <dd className="font-semibold tabular-nums">{formatINR(priced.total)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Next on this surface">
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li>Sign-in and role-based access, with staff accounts created by the admin.</li>
          <li>Products with variants, plans with billing frequency and the four plan policies.</li>
          <li>Tax rules and discount rules with their limits.</li>
        </ul>
      </Card>
    </Shell>
  );
}
