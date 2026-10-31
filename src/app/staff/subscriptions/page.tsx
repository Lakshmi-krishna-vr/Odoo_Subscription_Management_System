import { Badge, Card, PageHeader, Shell } from "@/components/ui";
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

export default async function StaffSubscriptionsPage() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [subscriptions, total, dueToday] = await Promise.all([
    prisma.subscription.findMany({
      orderBy: { nextBillingDate: "asc" },
      take: 50,
      include: {
        customer: true,
        plan: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.subscription.count(),
    prisma.subscription.count({
      where: { nextBillingDate: { lte: today } },
    }),
  ]);

  return (
    <Shell role="staff">
      <PageHeader
        title="Subscriptions"
        subtitle="Every subscription, soonest billing date first."
        right={<Badge>{total} total</Badge>}
      />

      <p className="text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">{total}</span>{" "}
        subscription{total === 1 ? "" : "s"} in total ·{" "}
        <span className="font-medium text-[var(--foreground)]">{dueToday}</span>{" "}
        due for billing today or earlier
      </p>

      <Card title="Subscriptions" description="Next 50 by next billing date.">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Start</th>
              <th>Expires</th>
              <th>Next billing</th>
              <th className="num">Lines</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-[var(--muted)]">
                  No subscriptions yet.
                </td>
              </tr>
            ) : (
              subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="font-medium">{subscription.number}</td>
                  <td>{subscription.customer.companyName}</td>
                  <td>{subscription.plan.name}</td>
                  <td>
                    <Badge>{subscription.status}</Badge>
                  </td>
                  <td>{formatDate(subscription.startDate)}</td>
                  <td>{formatDate(subscription.expiryDate)}</td>
                  <td>{formatDate(subscription.nextBillingDate)}</td>
                  <td className="num">{subscription._count.lines}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
