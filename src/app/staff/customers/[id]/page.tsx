import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge, Card, PageHeader, Shell, Stat } from "@/components/ui";
import { formatINR } from "@/core/money";
import { todayIso } from "@/core/periods";
import { invoiceBalance } from "@/core/state";
import { customerStandings } from "@/server/customers";
import { prisma } from "@/server/db";
import { INVOICE_STATUS_LABEL, displayStatusWhere, invoiceDisplayStatus } from "@/server/invoices";
import { SUBSCRIPTION_STATUS_LABEL } from "@/server/subscriptions";
import { CustomerForm } from "./customer-form";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loadCustomer = cache((customerId: string) =>
  prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      code: true,
      companyName: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      paymentTermsDays: true,
      isActive: true,
      createdAt: true,
    },
  }),
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = UUID.test(id) ? await loadCustomer(id) : null;
  return { title: `${customer?.companyName ?? "Customer"} · Brightloop` };
}

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

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const today = todayIso();
  const [customer, standings, overdueCount, paidSum, subscriptions, plans, invoices] =
    await Promise.all([
      loadCustomer(id),
      customerStandings([id]),
      prisma.invoice.count({
        where: { AND: [{ customerId: id }, displayStatusWhere("overdue", today)] },
      }),
      prisma.payment.aggregate({ where: { customerId: id }, _sum: { amount: true } }),
      prisma.subscription.findMany({
        where: { customerId: id },
        orderBy: { nextBillingDate: "asc" },
        select: { id: true, number: true, status: true, nextBillingDate: true, planId: true },
      }),
      prisma.plan.findMany({
        where: { subscriptions: { some: { customerId: id } } },
        select: { id: true, name: true },
      }),
      prisma.invoice.findMany({
        where: { customerId: id },
        orderBy: { invoiceDate: "desc" },
        take: 20,
        select: {
          id: true,
          number: true,
          status: true,
          invoiceDate: true,
          dueDate: true,
          total: true,
          amountPaid: true,
        },
      }),
    ]);
  if (!customer) notFound();
  const standing = standings.get(customer.id);
  const planNames = new Map(plans.map((plan) => [plan.id, plan.name]));

  return (
    <Shell role="staff">
      <PageHeader
        title={customer.companyName}
        subtitle={customer.code}
        right={<Badge>{customer.isActive ? "Active" : "Inactive"}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Active subscriptions" value={String(standing?.activeSubscriptions ?? 0)} />
        <Stat label="Outstanding" value={formatINR(standing?.outstanding ?? 0)} />
        <Stat label="Overdue invoices" value={String(overdueCount)} />
        <Stat label="Total paid" value={formatINR(paidSum._sum.amount ?? 0)} />
      </div>

      <Card title="Details" description="Company name and code are managed by an admin.">
        <dl className="mb-5 grid gap-2 text-sm sm:grid-cols-3">
          <Detail label="Company">{customer.companyName}</Detail>
          <Detail label="Customer code">{customer.code}</Detail>
          <Detail label="Customer since">{formatDate(customer.createdAt)}</Detail>
        </dl>
        <CustomerForm
          customer={{
            id: customer.id,
            contactName: customer.contactName,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            paymentTermsDays: customer.paymentTermsDays,
          }}
        />
      </Card>

      <Card title="Subscriptions">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Next billing</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-[var(--muted)]">
                  This customer has no subscriptions yet.
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>
                    <a
                      href={`/staff/subscriptions/${subscription.id}`}
                      className="font-medium text-[#1f5eff] hover:underline"
                    >
                      {subscription.number}
                    </a>
                  </td>
                  <td>{planNames.get(subscription.planId) ?? "—"}</td>
                  <td>
                    <Badge>{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</Badge>
                  </td>
                  <td>{formatDate(subscription.nextBillingDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Card title="Latest invoices" description="The 20 most recent by invoice date.">
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
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-[var(--muted)]">
                  This customer has no invoices yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <a
                      href={`/staff/invoices/${invoice.id}`}
                      className="font-medium text-[#1f5eff] hover:underline"
                    >
                      {invoice.number ?? "Draft"}
                    </a>
                  </td>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{formatDate(invoice.dueDate)}</td>
                  <td>
                    <Badge>{INVOICE_STATUS_LABEL[invoiceDisplayStatus(invoice, today)]}</Badge>
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
