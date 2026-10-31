import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { prisma } from "@/server/db";
import { InvoiceActions } from "./invoice-actions";
import { PaymentForm } from "./payment-form";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold">{children}</h2>;
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
      redemptions: { include: { discount: true } },
    },
  });
  if (!invoice) notFound();

  const { customer, subscription } = invoice;
  const balanceDue = invoiceBalance(invoice.total, invoice.amountPaid);

  return (
    <Shell role="staff">
      <PageHeader
        title={invoice.number ?? "Draft invoice"}
        subtitle={customer.companyName}
        right={
          <div className="flex items-start gap-2">
            <InvoiceActions
              invoiceId={invoice.id}
              status={invoice.status}
              amountPaid={invoice.amountPaid}
              number={invoice.number}
            />
            <PrintButton />
          </div>
        }
      />

      <Card>
        <SectionTitle>Customer and document</SectionTitle>
        <div className="grid gap-6 sm:grid-cols-2">
          <dl className="grid gap-2 text-sm">
            <Detail label="Company">{customer.companyName}</Detail>
            <Detail label="Contact">{customer.contactName}</Detail>
            <Detail label="Email">{customer.email}</Detail>
            <Detail label="Address">{customer.address ?? "—"}</Detail>
            <Detail label="Customer code">{customer.code}</Detail>
            <Detail label="Payment terms">{customer.paymentTermsDays} days</Detail>
          </dl>
          <dl className="grid gap-2 text-sm">
            <Detail label="Invoice date">{formatDate(invoice.invoiceDate)}</Detail>
            <Detail label="Due date">{formatDate(invoice.dueDate)}</Detail>
            <Detail label="Period">
              {formatDate(invoice.periodStart)} to {formatDate(invoice.periodEnd)}
            </Detail>
            <Detail label="Subscription">{subscription?.number ?? "—"}</Detail>
            <Detail label="Plan">{subscription?.plan.name ?? "—"}</Detail>
            <Detail label="Status">
              <Badge>{invoice.status}</Badge>
            </Detail>
          </dl>
        </div>
      </Card>

      <Card>
        <SectionTitle>Lines</SectionTitle>
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
            {invoice.lines.map((line) => (
              <tr key={line.id}>
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

        <dl className="mt-4 grid gap-2 text-sm break-inside-avoid sm:grid-cols-3">
          <Detail label="Subtotal">
            <span className="tabular-nums">{formatINR(invoice.subtotal)}</span>
          </Detail>
          <Detail label="Discount">
            <span className="tabular-nums">{formatINR(invoice.discountTotal)}</span>
          </Detail>
          <Detail label="Tax">
            <span className="tabular-nums">{formatINR(invoice.taxTotal)}</span>
          </Detail>
          <Detail label="Total">
            <span className="font-semibold tabular-nums">{formatINR(invoice.total)}</span>
          </Detail>
          <Detail label="Amount paid">
            <span className="tabular-nums">{formatINR(invoice.amountPaid)}</span>
          </Detail>
          <Detail label="Balance due">
            <span className="font-semibold tabular-nums">{formatINR(balanceDue)}</span>
          </Detail>
        </dl>
      </Card>

      <Card>
        <SectionTitle>Payments</SectionTitle>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th className="num">Amount</th>
              <th>Date</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {invoice.payments.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-[var(--muted)]">
                  No payments recorded.
                </td>
              </tr>
            ) : (
              invoice.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.method}</td>
                  <td className="num">{formatINR(payment.amount)}</td>
                  <td>{formatDate(payment.paidAt)}</td>
                  <td>{payment.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {/* payment form — Seb */}
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <SectionTitle>Record a payment</SectionTitle>
          <PaymentForm
            invoiceId={invoice.id}
            balance={balanceDue}
            disabled={
              invoice.status === "cancelled" || !invoice.number || balanceDue === 0
            }
          />
        </div>
      </Card>

      {invoice.redemptions.length > 0 ? (
        <Card>
          <SectionTitle>Discounts</SectionTitle>
          <ul className="space-y-1 text-sm">
            {invoice.redemptions.map((redemption) => (
              <li key={redemption.id}>
                {`${redemption.discount.name} — ${formatINR(redemption.amount)}`}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </Shell>
  );
}
