import { Badge, Card, PageHeader, Shell, Stat } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { todayIso } from "@/core/periods";
import { prisma } from "@/server/db";
import type { DashboardKpis } from "@/contracts";

export const dynamic = "force-dynamic";

function monthRange(today: string): { from: Date; to: Date } {
  return {
    from: new Date(`${today.slice(0, 7)}-01T00:00:00Z`),
    to: new Date(`${today}T23:59:59Z`),
  };
}

function formatDay(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function FinancePage() {
  const today = todayIso();
  const { from, to } = monthRange(today);

  const [
    activeSubscriptions,
    invoiced,
    collected,
    openInvoices,
    overdueCount,
    byMethod,
    overdueByCustomer,
  ] = await Promise.all([
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { invoiceDate: { gte: from, lte: to }, status: { not: "cancelled" } },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paidAt: { gte: from, lte: to } },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["confirmed", "partially_paid", "overdue"] } },
      select: { total: true, amountPaid: true },
    }),
    prisma.invoice.count({ where: { status: "overdue" } }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      where: { paidAt: { gte: from, lte: to } },
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { status: "overdue" },
      _sum: { total: true, amountPaid: true },
      orderBy: { _sum: { total: "desc" } },
      take: 5,
    }),
  ]);

  const kpis: DashboardKpis = {
    activeSubscriptions,
    invoicedInPeriod: invoiced._sum.total ?? 0,
    collectedInPeriod: collected._sum.amount ?? 0,
    outstanding: openInvoices.reduce(
      (sum, invoice) => sum + invoiceBalance(invoice.total, invoice.amountPaid),
      0,
    ),
    overdueCount,
  };

  const customerNames = await prisma.customer.findMany({
    where: { id: { in: overdueByCustomer.map((row) => row.customerId) } },
    select: { id: true, companyName: true },
  });
  const nameById = new Map(customerNames.map((customer) => [customer.id, customer.companyName]));

  return (
    <Shell role="staff">
      <PageHeader
        title="Finance"
        subtitle={`Invoiced and collected this month (from ${formatDay(from)}).`}
        right={<Badge>{overdueCount} overdue</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Active subscriptions" value={String(kpis.activeSubscriptions)} />
        <Stat label="Invoiced this month" value={formatINR(kpis.invoicedInPeriod)} />
        <Stat label="Collected this month" value={formatINR(kpis.collectedInPeriod)} />
        <Stat label="Outstanding" value={formatINR(kpis.outstanding)} />
        <Stat label="Overdue invoices" value={String(kpis.overdueCount)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Collected by method" description="Payments received this month.">
          {byMethod.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No payments this month yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {byMethod
                  .slice()
                  .sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))
                  .map((row) => (
                    <tr key={row.method}>
                      <td className="capitalize">{row.method}</td>
                      <td className="num">{formatINR(row._sum.amount ?? 0)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Largest overdue accounts" description="Five customers with the most overdue value.">
          {overdueByCustomer.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nothing overdue.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th className="num">Invoiced</th>
                  <th className="num">Still owed</th>
                </tr>
              </thead>
              <tbody>
                {overdueByCustomer.map((row) => (
                  <tr key={row.customerId}>
                    <td>{nameById.get(row.customerId) ?? row.customerId}</td>
                    <td className="num">{formatINR(row._sum.total ?? 0)}</td>
                    <td className="num font-medium">
                      {formatINR(
                        invoiceBalance(row._sum.total ?? 0, row._sum.amountPaid ?? 0),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}
