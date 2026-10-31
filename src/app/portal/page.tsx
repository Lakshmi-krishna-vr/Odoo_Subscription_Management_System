import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell, Stat } from "@/components/ui";
import { formatINR } from "@/core/money";
import { invoiceBalance } from "@/core/state";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { formatDate } from "./format";
import { PortalTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const user = await requireRole(["customer"]);
  if (!user.customerId) notFound();

  const customerId = user.customerId;

  const [subscriptions, openInvoices, recent] = await Promise.all([
    prisma.subscription.findMany({
      where: { customerId, status: { in: ["active", "paused"] } },
      orderBy: { nextBillingDate: "asc" },
      select: { id: true, status: true, nextBillingDate: true },
    }),
    prisma.invoice.findMany({
      where: {
        customerId,
        status: { in: ["confirmed", "partially_paid", "overdue"] },
      },
      select: { total: true, amountPaid: true },
    }),
    prisma.invoice.findMany({
      where: { customerId, status: { not: "draft" } },
      orderBy: { invoiceDate: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        total: true,
        amountPaid: true,
      },
    }),
  ]);

  const outstanding = openInvoices.reduce(
    (sum, invoice) => sum + invoiceBalance(invoice.total, invoice.amountPaid),
    0,
  );
  const nextBilling = subscriptions.find((sub) => sub.status === "active")?.nextBillingDate ?? null;

  return (
    <Shell role="customer">
      <PageHeader
        title={user.customer?.companyName ?? "Your account"}
        subtitle="Your subscriptions, invoices and what is due."
        right={<Badge>{subscriptions.length} open</Badge>}
      />

      <PortalTabs active="overview" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active subscriptions" value={String(subscriptions.filter((s) => s.status === "active").length)} />
        <Stat label="Outstanding" value={formatINR(outstanding)} />
        <Stat label="Next billing" value={formatDate(nextBilling)} />
      </div>

      <Card title="Recent invoices" description="The five most recent invoices on your account.">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Invoice date</th>
              <th>Due date</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  No invoices yet.
                </td>
              </tr>
            ) : (
              recent.map((invoice) => (
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
