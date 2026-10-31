import { Badge, Card, PageHeader, Shell, Stat } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { todayIso } from "@/core/periods";
import { prisma } from "@/server/db";
import type { DashboardKpis } from "@/contracts";

export const dynamic = "force-dynamic";

function monthRange(month: string): { from: Date; to: Date; label: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: new Date(`${month}-01T00:00:00Z`),
    to: new Date(`${month}-${String(lastDay).padStart(2, "0")}T23:59:59Z`),
    label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

function formatDay(value: Date): string {
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const today = todayIso();
  const requested = (await searchParams).month;
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : today.slice(0, 7);
  const { from, to, label } = monthRange(month);

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
        subtitle={`Invoiced and collected in ${label}.`}
        right={
          <form method="get" className="flex items-center gap-2">
            <input
              type="month"
              name="month"
              defaultValue={month}
              className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
            />
            <button
              type="submit"
              className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-xs hover:border-[#1f5eff]"
            >
              Apply
            </button>
            <Badge>{overdueCount} overdue</Badge>
          </form>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Active subscriptions" value={String(kpis.activeSubscriptions)} />
        <Stat label="Invoiced in period" value={formatINR(kpis.invoicedInPeriod)} />
        <Stat label="Collected in period" value={formatINR(kpis.collectedInPeriod)} />
        <Stat label="Outstanding" value={formatINR(kpis.outstanding)} />
        <Stat label="Overdue invoices" value={String(kpis.overdueCount)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Collected by method" description={`Payments received in ${label}.`}>
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
