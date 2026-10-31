import { InvoiceStatus } from "@prisma/client";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { todayIso } from "@/core/periods";
import { prisma } from "@/server/db";
import { BillingPanel } from "./billing-panel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const today = todayIso();

  const [drafts, confirmed, dueCount, lastRuns] = await Promise.all([
    prisma.invoice.count({ where: { status: InvoiceStatus.draft } }),
    prisma.invoice.count({ where: { status: InvoiceStatus.confirmed } }),
    prisma.subscription.count({
      where: { status: "active", nextBillingDate: { lte: new Date(`${today}T00:00:00Z`) } },
    }),
    prisma.invoice.findMany({
      where: { status: InvoiceStatus.draft },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: true },
    }),
  ]);

  return (
    <Shell role="staff">
      <PageHeader
        title="Billing run"
        subtitle="Create every invoice that is due, without typing anything by hand."
        right={<Badge>{dueCount} due today</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Due now</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{dueCount}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Draft invoices</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{drafts}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Confirmed</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{confirmed}</div>
        </div>
      </div>

      <BillingPanel today={today} />

      {lastRuns.length > 0 ? (
        <Card title="Newest draft invoices" description="Created by the last run.">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Period start</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {lastRuns.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.customer.companyName}</td>
                  <td>{invoice.periodStart?.toISOString().slice(0, 10) ?? "—"}</td>
                  <td className="num">{formatINR(invoice.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </Shell>
  );
}
