import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";

// Read-only page: the build must never hit the database.
export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function StaffInvoicesPage() {
  const [invoices, sums, overdueCount] = await Promise.all([
    prisma.invoice.findMany({
      orderBy: { invoiceDate: "desc" },
      take: 50,
      include: { customer: true },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.count({ where: { status: "overdue" } }),
  ]);

  const invoiced = sums._sum.total ?? 0;
  const collected = sums._sum.amountPaid ?? 0;
  const outstanding = invoiced - collected;

  return (
    <Shell role="staff">
      <PageHeader
        title="Invoices"
        subtitle="Billed, collected and still outstanding."
        right={<Badge>{overdueCount} overdue</Badge>}
      />

      <dl className="grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-[var(--muted)]">Total invoiced</dt>
          <dd className="tabular-nums">{formatINR(invoiced)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Collected</dt>
          <dd className="tabular-nums">{formatINR(collected)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Outstanding</dt>
          <dd className="tabular-nums">{formatINR(outstanding)}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--muted)]">Overdue invoices</dt>
          <dd className="font-semibold tabular-nums">{overdueCount}</dd>
        </div>
      </dl>

      <Card title="Invoices" description="Most recent 50 by invoice date.">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Invoice date</th>
              <th>Due date</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--muted)]">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const balance = Math.max(0, invoice.total - invoice.amountPaid);

                return (
                  <tr key={invoice.id}>
                    <td className="font-medium">{invoice.number ?? "—"}</td>
                    <td>{invoice.customer.companyName}</td>
                    <td>{formatDate(invoice.invoiceDate)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>
                      <Badge>{invoice.status}</Badge>
                    </td>
                    <td className="num">{formatINR(invoice.total)}</td>
                    <td className="num">{formatINR(invoice.amountPaid)}</td>
                    <td className="num font-medium">{formatINR(balance)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
