import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PERIOD_LABEL: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

/** Date-only columns come back at UTC midnight; format without a timezone shift. */
function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatAvailability(from: Date | null, to: Date | null): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return "Always";
}

export default async function PlansPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="Plans"
        subtitle="Billing frequency, availability window and the four subscription policies."
        right={<Badge>{plans.length} plans</Badge>}
      />

      <Card title="Subscription plans" description="Read-only view of the plan catalogue.">
        <p className="mb-3 text-sm text-[var(--muted)]">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </p>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th className="num">Price</th>
              <th>Billing period</th>
              <th className="num">Min qty</th>
              <th>Available</th>
              <th>Policies</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-sm text-[var(--muted)]">
                  No plans yet.
                </td>
              </tr>
            ) : (
              plans.map((plan) => {
                const policies = [
                  plan.autoClose ? "auto-close" : null,
                  plan.closable ? "can close early" : null,
                  plan.pausable ? "can pause" : null,
                  plan.renewable ? "can renew" : null,
                ].filter((policy): policy is string => policy !== null);

                return (
                  <tr key={plan.id}>
                    <td className="font-medium">{plan.name}</td>
                    <td className="num tabular-nums">{formatINR(plan.price)}</td>
                    <td>
                      {PERIOD_LABEL[plan.billingPeriod] ?? plan.billingPeriod}
                      {plan.intervalCount > 1 ? (
                        <span className="text-xs text-[var(--muted)]">
                          {" "}
                          × {plan.intervalCount}
                        </span>
                      ) : null}
                    </td>
                    <td className="num tabular-nums">{plan.minQuantity}</td>
                    <td className="text-sm">
                      {formatAvailability(plan.availableFrom, plan.availableTo)}
                    </td>
                    <td>
                      {policies.length === 0 ? (
                        "—"
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {policies.map((policy) => (
                            <Badge key={policy}>{policy}</Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td>
                      <Badge>{plan.isActive ? "Active" : "Inactive"}</Badge>
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
