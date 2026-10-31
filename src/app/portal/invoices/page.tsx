import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { formatDate } from "../format";
import { PortalTabs } from "../tabs";

export const dynamic = "force-dynamic";

export default async function PortalInvoicesPage() {
  const user = await requireRole(["customer"]);
  if (!user.customerId) notFound();

  const invoices = await prisma.invoice.findMany({
    where: { customerId: user.customerId, status: { not: "draft" } },
    orderBy: { invoiceDate: "desc" },
    take: 100,
    select: {
      id: true,
      number: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      total: true,
      amountPaid: true,
    },
  });

  const outstanding = invoices.reduce(
    (sum, invoice) => sum + invoiceBalance(invoice.total, invoice.amountPaid),
    0,
  );

  return (
    <Shell role="customer">
      <PageHeader
        title="Invoices"
        subtitle="Everything you have been billed, and what is still due."
        right={<Badge>{formatINR(outstanding)} due</Badge>}
      />

      <PortalTabs active="invoices" />

      <Card title="Your invoices" description="Most recent 100, newest first.">
        <table>
          <thead>
            <tr>
              <th>Number</th>
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
                <td colSpan={7} className="text-[var(--muted)]">
                  You have no invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-medium">
                    <a className="text-[#1f5eff] hover:underline" href={`/portal/invoices/${invoice.id}`}>
                      {invoice.number ?? "—"}
                    </a>
                  </td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>
                    <Badge>{invoice.status}</Badge>
                  </td>
                  <td className="num">{formatINR(invoice.total)}</td>
                  <td className="num">{formatINR(invoice.amountPaid)}</td>
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
