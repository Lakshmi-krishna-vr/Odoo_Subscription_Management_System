import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SubStatus } from "@prisma/client";
import { Card, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { loadSubscriptionDocument } from "@/server/subscriptions";
import { PrintButton } from "@/app/staff/invoices/[id]/print-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const QUOTABLE_STATUSES: SubStatus[] = ["draft", "quotation"];

const PERIOD_LABEL: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const document = UUID.test(id) ? await loadSubscriptionDocument(id) : null;
  const title = document ? `Quotation ${document.subscription.number}` : "Quotation";
  return { title: `${title} · Brightloop` };
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const document = await loadSubscriptionDocument(id);
  if (!document || !QUOTABLE_STATUSES.includes(document.subscription.status)) notFound();

  const { subscription, customer, plan, nextInvoice: quotedPrices } = document;
  const validUntil = document.validUntil
    ? formatDate(new Date(`${document.validUntil}T00:00:00Z`))
    : "—";
  const billingPeriod = `${PERIOD_LABEL[plan.billingPeriod] ?? plan.billingPeriod}${
    plan.intervalCount > 1 ? ` × ${plan.intervalCount}` : ""
  }`;

  return (
    <Shell role="staff">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Quotation {subscription.number}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Brightloop Software</p>
        </div>
        <div className="no-print flex items-center gap-3">
          <a
            href={`/staff/subscriptions/${subscription.id}`}
            className="text-sm font-medium text-[#1f5eff] hover:underline"
          >
            Back to subscription
          </a>
          <PrintButton />
        </div>
      </div>

      <Card>
        <div className="grid gap-6 sm:grid-cols-2">
          <dl className="grid gap-2 text-sm">
            <Detail label="Prepared for">{customer.companyName}</Detail>
            <Detail label="Contact">{customer.contactName}</Detail>
            <Detail label="Email">{customer.email}</Detail>
            <Detail label="Address">{customer.address ?? "—"}</Detail>
          </dl>
          <dl className="grid gap-2 text-sm">
            <Detail label="Quote date">{formatDate(subscription.createdAt)}</Detail>
            <Detail label="Valid until">{validUntil}</Detail>
            <Detail label="Plan">
              {plan.name} · {billingPeriod}
            </Detail>
            <Detail label="Start date">{formatDate(subscription.startDate)}</Detail>
            <Detail label="Expiry date">
              {subscription.expiryDate ? formatDate(subscription.expiryDate) : "Open-ended"}
            </Detail>
          </dl>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Price per billing period</h2>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Taxable</th>
              <th className="num">Tax rate</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {quotedPrices.lines.map((line, lineIndex) => (
              <tr key={`${line.productId}-${lineIndex}`}>
                <td>{line.description}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{formatINR(line.unitPrice)}</td>
                <td className="num">{formatINR(line.discountAmount)}</td>
                <td className="num">{formatINR(line.taxableAmount)}</td>
                <td className="num">{line.taxRateBp / 100}%</td>
                <td className="num font-medium">{formatINR(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-4 grid gap-2 text-sm break-inside-avoid sm:grid-cols-4">
          <Detail label="Subtotal">
            <span className="tabular-nums">{formatINR(quotedPrices.subtotal)}</span>
          </Detail>
          <Detail label="Discount">
            <span className="tabular-nums">{formatINR(quotedPrices.discountTotal)}</span>
          </Detail>
          <Detail label="Tax">
            <span className="tabular-nums">{formatINR(quotedPrices.taxTotal)}</span>
          </Detail>
          <Detail label="Total">
            <span className="font-semibold tabular-nums">{formatINR(quotedPrices.total)}</span>
          </Detail>
        </dl>

        <p className="mt-4 text-sm text-[var(--muted)]">
          Payment terms: {subscription.paymentTermsDays === 0
            ? "due on receipt"
            : `${subscription.paymentTermsDays} days from the invoice date`}
          .
        </p>
      </Card>
    </Shell>
  );
}
