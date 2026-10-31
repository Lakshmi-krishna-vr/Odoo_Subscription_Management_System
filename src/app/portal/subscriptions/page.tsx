import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { formatDate } from "../format";
import { PortalTabs } from "../tabs";

export const dynamic = "force-dynamic";

export default async function PortalSubscriptionsPage() {
  const user = await requireRole(["customer"]);
  if (!user.customerId) notFound();

  const subscriptions = await prisma.subscription.findMany({
    where: { customerId: user.customerId },
    orderBy: { nextBillingDate: "asc" },
    include: { plan: true, _count: { select: { lines: true } } },
  });

  return (
    <Shell role="customer">
      <PageHeader
        title="Subscriptions"
        subtitle="Everything your company is subscribed to."
        right={<Badge>{subscriptions.length}</Badge>}
      />

      <PortalTabs active="subscriptions" />

      <Card title="Your subscriptions">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Start</th>
              <th>Expires</th>
              <th>Next billing</th>
              <th className="num">Price</th>
              <th>Options</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--muted)]">
                  You have no subscriptions yet.
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => {
                const policies = [
                  subscription.plan.pausable ? "can pause" : null,
                  subscription.plan.renewable ? "can renew" : null,
                  subscription.plan.closable ? "can close early" : null,
                  subscription.plan.autoClose ? "closes at expiry" : null,
                ].filter((policy): policy is string => policy !== null);

                return (
                  <tr key={subscription.id}>
                    <td className="font-mono text-xs">{subscription.number}</td>
                    <td>{subscription.plan.name}</td>
                    <td>
                      <Badge>{subscription.status}</Badge>
                    </td>
                    <td>{formatDate(subscription.startDate)}</td>
                    <td>{formatDate(subscription.expiryDate)}</td>
                    <td>{formatDate(subscription.nextBillingDate)}</td>
                    <td className="num">{formatINR(subscription.plan.price)}</td>
                    <td className="text-xs text-[var(--muted)]">
                      {policies.length > 0 ? policies.join(" · ") : "—"}
                    </td>
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
