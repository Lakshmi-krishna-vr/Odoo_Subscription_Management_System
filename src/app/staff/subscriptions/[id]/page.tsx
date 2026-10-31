import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SubStatus } from "@prisma/client";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { prisma } from "@/server/db";
import { INVOICE_STATUS_LABEL, invoiceDisplayStatus } from "@/server/invoices";
import {
  SUBSCRIPTION_STATUS_LABEL,
  allowedEvents,
  loadSubscriptionDocument,
} from "@/server/subscriptions";
import { LinesEditor } from "./lines-editor";
import { SubscriptionActions } from "./subscription-actions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_STEPS: { status: SubStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "quotation", label: "Quotation" },
  { status: "confirmed", label: "Confirmed" },
  { status: "active", label: "Active" },
  { status: "closed", label: "Closed" },
];

const EDITABLE_STATUSES: SubStatus[] = ["draft", "quotation"];

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
  return { title: `${document?.subscription.number ?? "Subscription"} · Brightloop` };
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

function StatusTrack({ status }: { status: SubStatus }) {
  const trackStatus = status === "paused" ? "active" : status;
  const currentIndex = STATUS_STEPS.findIndex((step) => step.status === trackStatus);

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {STATUS_STEPS.map((step, stepIndex) => {
        const isCurrent = step.status === status;
        const isReached = stepIndex <= currentIndex;
        const stepClass = isCurrent
          ? "border-[#1f5eff] bg-[#1f5eff] text-white"
          : isReached
            ? "border-[#1f5eff] text-[#1f5eff]"
            : "border-[var(--border)] text-[var(--muted)]";

        return (
          <span key={step.status} className="flex items-center gap-2">
            {stepIndex > 0 ? <span className="text-[var(--muted)]">→</span> : null}
            <span className={`rounded-full border px-3 py-1 font-medium ${stepClass}`}>
              {step.label}
            </span>
          </span>
        );
      })}
      {status === "paused" ? (
        <span className="ml-2 rounded-full border border-amber-500 bg-amber-500 px-3 py-1 font-medium text-white">
          Paused
        </span>
      ) : null}
    </div>
  );
}

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [document, invoices] = await Promise.all([
    loadSubscriptionDocument(id),
    prisma.invoice.findMany({
      where: { subscriptionId: id },
      orderBy: { invoiceDate: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        invoiceDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
      },
    }),
  ]);
  if (!document) notFound();

  const { subscription, customer, plan, lines, nextInvoice, productNames, activeProducts, variants } =
    document;
  const canEditLines = EDITABLE_STATUSES.includes(subscription.status);
  const variantLabels = new Map(variants.map((variant) => [variant.id, variant.label]));
  const validUntil = subscription.status === "quotation" ? document.validUntil : null;
  const policies = [
    plan.autoClose ? "auto-close" : null,
    plan.closable ? "can close early" : null,
    plan.pausable ? "can pause" : null,
    plan.renewable ? "can renew" : null,
  ].filter((policy): policy is string => policy !== null);

  return (
    <Shell role="staff">
      <PageHeader
        title={subscription.number}
        subtitle={customer.companyName}
        right={
          <div className="flex items-start gap-2">
            <Badge>{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</Badge>
            {canEditLines ? (
              <a
                href={`/staff/subscriptions/${subscription.id}/quote`}
                className="px-2 py-1.5 text-sm font-medium text-[#1f5eff] hover:underline"
              >
                View quotation
              </a>
            ) : null}
            <SubscriptionActions
              subscriptionId={subscription.id}
              allowedEvents={allowedEvents(subscription.status, plan)}
            />
          </div>
        }
      />

      <Card title="Where it stands">
        <StatusTrack status={subscription.status} />
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
          <Detail label="Created">{formatDate(subscription.createdAt)}</Detail>
          {validUntil ? (
            <Detail label="Quotation">
              Valid until {formatDate(new Date(`${validUntil}T00:00:00Z`))}
            </Detail>
          ) : null}
          <Detail label="Start date">{formatDate(subscription.startDate)}</Detail>
          <Detail label="Expiry date">
            {subscription.expiryDate ? formatDate(subscription.expiryDate) : "Open-ended"}
          </Detail>
          <Detail label="Next billing date">{formatDate(subscription.nextBillingDate)}</Detail>
          <Detail label="Current period">
            {formatDate(subscription.periodStart)} – {formatDate(subscription.periodEnd)}
          </Detail>
          {subscription.pausedAt ? (
            <Detail label="Paused on">{formatDate(subscription.pausedAt)}</Detail>
          ) : null}
          {subscription.closedReason ? (
            <Detail label="Closed reason">{subscription.closedReason}</Detail>
          ) : null}
        </dl>
      </Card>

      <Card title="Details">
        <div className="grid gap-6 sm:grid-cols-2">
          <dl className="grid gap-2 text-sm">
            <Detail label="Company">
              <a
                href={`/staff/customers/${customer.id}`}
                className="font-medium text-[#1f5eff] hover:underline"
              >
                {customer.companyName}
              </a>
            </Detail>
            <Detail label="Contact">{customer.contactName}</Detail>
            <Detail label="Email">{customer.email}</Detail>
            <Detail label="Payment terms">{subscription.paymentTermsDays} days</Detail>
          </dl>
          <dl className="grid gap-2 text-sm">
            <Detail label="Plan">{plan.name}</Detail>
            <Detail label="Price">
              <span className="tabular-nums">{formatINR(plan.price)}</span>
            </Detail>
            <Detail label="Billing period">
              {PERIOD_LABEL[plan.billingPeriod] ?? plan.billingPeriod}
              {plan.intervalCount > 1 ? (
                <span className="text-xs text-[var(--muted)]"> × {plan.intervalCount}</span>
              ) : null}
            </Detail>
            <Detail label="Minimum quantity">{plan.minQuantity}</Detail>
            <Detail label="Policies">
              {policies.length === 0 ? (
                "—"
              ) : (
                <span className="flex flex-wrap gap-1">
                  {policies.map((policy) => (
                    <Badge key={policy}>{policy}</Badge>
                  ))}
                </span>
              )}
            </Detail>
          </dl>
        </div>
      </Card>

      {canEditLines ? (
        <Card title="Edit lines" description="Lines can be changed until the subscription is confirmed.">
          <LinesEditor
            subscriptionId={subscription.id}
            lines={lines.map((line) => ({
              id: line.id,
              productName: productNames.get(line.productId) ?? "Product no longer active",
              variantLabel: line.variantId ? (variantLabels.get(line.variantId) ?? null) : null,
              quantity: line.quantity,
            }))}
            products={activeProducts}
            variants={variants}
          />
        </Card>
      ) : null}

      <Card
        title="Next invoice preview"
        description={`Priced as of ${formatDate(subscription.nextBillingDate)} with the same rules as the billing run.`}
      >
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
            {nextInvoice.lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  This subscription has no lines.
                </td>
              </tr>
            ) : (
              nextInvoice.lines.map((line, lineIndex) => (
                <tr key={`${line.productId}-${lineIndex}`}>
                  <td>{line.description}</td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{formatINR(line.unitPrice)}</td>
                  <td className="num">{formatINR(line.discountAmount)}</td>
                  <td className="num">{formatINR(line.taxableAmount)}</td>
                  <td className="num">{line.taxRateBp / 100}%</td>
                  <td className="num font-medium">{formatINR(line.lineTotal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <Detail label="Subtotal">
            <span className="tabular-nums">{formatINR(nextInvoice.subtotal)}</span>
          </Detail>
          <Detail label="Discount">
            <span className="tabular-nums">{formatINR(nextInvoice.discountTotal)}</span>
          </Detail>
          <Detail label="Tax">
            <span className="tabular-nums">{formatINR(nextInvoice.taxTotal)}</span>
          </Detail>
          <Detail label="Total">
            <span className="font-semibold tabular-nums">{formatINR(nextInvoice.total)}</span>
          </Detail>
        </dl>
      </Card>

      <Card title="Invoices">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Period</th>
              <th>Invoice date</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  No invoices for this subscription yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <a
                      href={`/staff/invoices/${invoice.id}`}
                      className="font-medium text-[#1f5eff] hover:underline"
                    >
                      {invoice.number ?? "Draft"}
                    </a>
                  </td>
                  <td>
                    {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                  </td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>
                    <Badge>{INVOICE_STATUS_LABEL[invoiceDisplayStatus(invoice)]}</Badge>
                  </td>
                  <td className="num">{formatINR(invoice.total)}</td>
                  <td className="num font-medium">
                    {formatINR(invoiceBalance(invoice.total, invoice.amountPaid))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
