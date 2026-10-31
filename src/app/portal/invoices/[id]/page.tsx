import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { formatDate, formatDateTime } from "../../format";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PortalInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireRole(["customer"]);
  if (!user.customerId) notFound();
  if (!UUID.test(id)) notFound();

  // The customer id is part of the query, not a check after the fact: a foreign
  // invoice returns null and becomes a 404, which also avoids confirming that
  // the invoice exists at all.
  const invoice = await prisma.invoice.findFirst({
    where: { id, customerId: user.customerId, status: { not: "draft" } },
    include: {
      customer: true,
      lines: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });

  if (!invoice) notFound();

  const balance = invoiceBalance(invoice.total, invoice.amountPaid);

  return (
    <Shell role="customer">
      <PageHeader
        title={`Invoice ${invoice.number ?? "—"}`}
        subtitle={`Issued ${formatDate(invoice.invoiceDate)} · due ${formatDate(invoice.dueDate)}`}
        right={
          <div className="flex items-center gap-2">
            <Badge>{invoice.status}</Badge>
            <PrintButton />
          </div>
        }
      />

      <Card>
        <div className="flex flex-wrap justify-between gap-6 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Billed to</div>
            <div className="mt-1 font-medium">{invoice.customer.companyName}</div>
            <div className="text-[var(--muted)]">{invoice.customer.contactName}</div>
            {invoice.customer.address ? (
              <div className="text-[var(--muted)]">{invoice.customer.address}</div>
            ) : null}
            <div className="text-[var(--muted)]">{invoice.customer.email}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Period</div>
            <div className="mt-1">
              {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
            </div>
            <div className="mt-2 text-xs uppercase tracking-wide text-[var(--muted)]">
              Payment terms
            </div>
            <div>{invoice.customer.paymentTermsDays} days</div>
          </div>
        </div>

        <table className="mt-6">
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Qty</th>
              <th className="num">Unit price</th>
              <th className="num">Discount</th>
              <th className="num">Taxable</th>
              <th className="num">Tax</th>
              <th className="num">Amount</th>
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
                <td className="num">
                  {formatINR(line.taxAmount)}
                  {line.taxRateBp > 0 ? (
                    <span className="ml-1 text-xs text-[var(--muted)]">
                      ({line.taxRateBp / 100}%)
                    </span>
                  ) : null}
                </td>
                <td className="num">{formatINR(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 grid max-w-xs gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Subtotal</dt>
            <dd className="tabular-nums">{formatINR(invoice.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Discount</dt>
            <dd className="tabular-nums">−{formatINR(invoice.discountTotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Tax</dt>
            <dd className="tabular-nums">{formatINR(invoice.taxTotal)}</dd>
          </div>
          <div className="flex justify-between border-t border-[var(--border)] pt-1 font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatINR(invoice.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Paid</dt>
            <dd className="tabular-nums">{formatINR(invoice.amountPaid)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>Balance</dt>
            <dd className="tabular-nums">{formatINR(balance)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Payments received" description="Recorded by the Brightloop team.">
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No payments recorded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Note</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDateTime(payment.paidAt)}</td>
                  <td>{payment.method}</td>
                  <td className="text-[var(--muted)]">{payment.note ?? "—"}</td>
                  <td className="num">{formatINR(payment.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </Shell>
  );
}
