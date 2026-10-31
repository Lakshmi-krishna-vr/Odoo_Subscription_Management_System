import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { priceDocument } from "@/core/pricing";
import { checkTransition } from "@/core/state";
import { prisma } from "@/server/db";
import type { PlanPolicy, SubEvent, SubStatus } from "@/contracts";
import { TransitionForm, type AllowedMove } from "./transition-form";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIFECYCLE: SubStatus[] = ["draft", "quotation", "confirmed", "active", "closed"];

const LABELS: Record<SubStatus, string> = {
  draft: "Draft",
  quotation: "Quotation",
  confirmed: "Confirmed",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

const MOVES: { event: SubEvent; label: string; primary?: boolean }[] = [
  { event: "send_quote", label: "Send quotation", primary: true },
  { event: "confirm", label: "Confirm", primary: true },
  { event: "activate", label: "Activate", primary: true },
  { event: "pause", label: "Pause" },
  { event: "resume", label: "Resume", primary: true },
  { event: "renew", label: "Renew" },
  { event: "close", label: "Close" },
];

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
      lines: true,
    },
  });
  if (!subscription) notFound();

  // the template is referenced by id only (no relation in the schema)
  const template = subscription.templateId
    ? await prisma.quotationTemplate.findUnique({
        where: { id: subscription.templateId },
        select: { name: true },
      })
    : null;

  const [products, taxes, discounts] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: subscription.lines.map((line) => line.productId) } },
    }),
    prisma.tax.findMany(),
    prisma.discount.findMany({ where: { isActive: true } }),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));

  // the same function that prices the quote prices the invoice
  const doc = priceDocument({
    lines: subscription.lines.map((line) => ({
      product: {
        id: line.productId,
        name: productById.get(line.productId)?.name ?? "Subscription line",
        salesPrice: line.unitPrice,
        taxId: line.taxId,
      },
      quantity: line.quantity,
    })),
    taxes: taxes.map((tax) => ({ id: tax.id, name: tax.name, rateBp: tax.rateBp })),
    discounts: discounts.map((discount) => ({
      id: discount.id,
      name: discount.name,
      type: discount.type,
      value: discount.value,
      scope: discount.scope,
      productIds: discount.productIds,
      minPurchase: discount.minPurchase,
      minQuantity: discount.minQuantity,
      startsAt: discount.startsAt ? discount.startsAt.toISOString().slice(0, 10) : null,
      endsAt: discount.endsAt ? discount.endsAt.toISOString().slice(0, 10) : null,
      usageLimit: discount.usageLimit,
      perCustomerLimit: discount.perCustomerLimit,
      usedCount: discount.usedCount,
      isActive: discount.isActive,
    })),
    asOf: subscription.startDate.toISOString().slice(0, 10),
  });

  const policy: PlanPolicy = {
    pausable: subscription.plan.pausable,
    renewable: subscription.plan.renewable,
    closable: subscription.plan.closable,
    autoClose: subscription.plan.autoClose,
  };

  const moves: AllowedMove[] = MOVES.filter(
    (move) => checkTransition({ from: subscription.status, event: move.event, plan: policy }).ok,
  );

  const currentIndex = LIFECYCLE.indexOf(subscription.status);

  return (
    <Shell role="staff">
      <PageHeader
        title={subscription.number}
        subtitle={`${subscription.customer.companyName} · ${subscription.plan.name}`}
        right={<Badge>{LABELS[subscription.status]}</Badge>}
      />

      <Card title="Where it stands">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {LIFECYCLE.map((step, index) => {
            const done = currentIndex >= 0 && index <= currentIndex;
            const isCurrent = step === subscription.status;
            return (
              <li key={step} className="flex items-center gap-2">
                <span
                  className={
                    isCurrent
                      ? "rounded-full bg-[#1f5eff] px-3 py-1 text-xs font-medium text-white"
                      : done
                        ? "rounded-full bg-[#e8efff] px-3 py-1 text-xs font-medium text-[#1f5eff]"
                        : "rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]"
                  }
                >
                  {LABELS[step]}
                </span>
                {index < LIFECYCLE.length - 1 ? (
                  <span className="text-[var(--muted)]">→</span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[var(--muted)]">Customer</dt>
            <dd>{subscription.customer.companyName}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Plan</dt>
            <dd>
              {subscription.plan.name} · every {subscription.plan.intervalCount}{" "}
              {subscription.plan.billingPeriod}
              {subscription.plan.intervalCount > 1 ? "s" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Start</dt>
            <dd>{formatDate(subscription.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Expires</dt>
            <dd>{formatDate(subscription.expiryDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Next billing</dt>
            <dd>{formatDate(subscription.nextBillingDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Payment terms</dt>
            <dd>{subscription.paymentTermsDays} days</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Template</dt>
            <dd>{template?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--muted)]">Min quantity</dt>
            <dd>{subscription.plan.minQuantity}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Lines" description="Priced by the same function the invoices use.">
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
            {doc.lines.map((line, index) => (
              <tr key={`${line.productId}-${index}`}>
                <td>{line.description}</td>
                <td className="num">{line.quantity}</td>
                <td className="num">{formatINR(line.unitPrice)}</td>
                <td className="num">{formatINR(line.discountAmount)}</td>
                <td className="num">{formatINR(line.taxableAmount)}</td>
                <td className="num">{formatINR(line.taxAmount)}</td>
                <td className="num font-medium">{formatINR(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 grid max-w-xs gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Subtotal</dt>
            <dd className="tabular-nums">{formatINR(doc.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Discount</dt>
            <dd className="tabular-nums">−{formatINR(doc.discountTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Tax</dt>
            <dd className="tabular-nums">{formatINR(doc.taxTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatINR(doc.total)}</dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Next step"
        description="Only the moves the plan allows are offered here."
      >
        <TransitionForm subscriptionId={subscription.id} moves={moves} />
      </Card>
    </Shell>
  );
}
