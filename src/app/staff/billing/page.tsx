import { InvoiceStatus } from "@prisma/client";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";
import { todayIST } from "@/server/billing";
import { BillingPanel } from "./billing-panel";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const today = todayIST();

  const [drafts, confirmed, dueCount, lastRuns, recentRuns] = await Promise.all([
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
    prisma.billingRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
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

      {recentRuns.length > 0 ? (
        <Card title="Recent runs" description="Audit log of previous billing runs and previews.">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>As of</th>
                <th>Mode</th>
                <th className="num">Considered</th>
                <th className="num">Created</th>
                <th className="num">Skipped</th>
                <th className="num">Errors</th>
                <th className="num">Value</th>
                <th className="num">Duration</th>
                <th>Triggered by</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id}>
                  <td className="text-xs text-[var(--muted)]">
                    {run.createdAt.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    {run.asOf.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    <Badge>{run.dryRun ? "Preview" : "Run"}</Badge>
                  </td>
                  <td className="num">{run.considered}</td>
                  <td className="num">{run.created}</td>
                  <td className="num">{run.skipped}</td>
                  <td className="num">{run.errorCount}</td>
                  <td className="num">{formatINR(run.totalValue)}</td>
                  <td className="num">{run.durationMs} ms</td>
                  <td>{run.triggeredBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

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
