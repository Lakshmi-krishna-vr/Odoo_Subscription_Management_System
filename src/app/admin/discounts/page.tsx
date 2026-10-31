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

/** Date-only columns come back at UTC midnight; format without a timezone shift. */
function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function formatWindow(from: Date | null, to: Date | null): string {
  if (from && to) return `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Until ${formatDate(to)}`;
  return "Always";
}

function formatValue(type: string, value: number): string {
  if (type === "fixed") return formatINR(value);
  const percent = value / 100;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`;
}

function formatUsage(usedCount: number, usageLimit: number | null, perCustomerLimit: number | null): string {
  const overall =
    usageLimit === null ? `${usedCount} used` : `${usedCount} / ${usageLimit}`;
  if (perCustomerLimit === null) return overall;
  return `${overall} · ${perCustomerLimit} per customer`;
}

export default async function DiscountsPage() {
  const discounts = await prisma.discount.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="Discounts"
        subtitle="Fixed and percentage rules with a date window, usage limits and product or subscription scope."
        right={
          <div className="flex items-center gap-3">
            <Badge>{discounts.length} rules</Badge>
            <a
              href="/admin/discounts/new"
              className="rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8]"
            >
              New Discount
            </a>
          </div>
        }
      />

      <Card
        title="Discount rules"
        description="Percentages are stored as basis points; fixed amounts as paise."
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          {discounts.length} {discounts.length === 1 ? "discount" : "discounts"}
        </p>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th className="num">Value</th>
              <th>Scope</th>
              <th>Window</th>
              <th>Usage</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-sm text-[var(--muted)]">
                  No discounts yet.
                </td>
              </tr>
            ) : (
              discounts.map((discount) => (
                <tr key={discount.id}>
                  <td className="font-medium">{discount.name}</td>
                  <td>{discount.code ?? "—"}</td>
                  <td className="num tabular-nums">{formatValue(discount.type, discount.value)}</td>
                  <td className="capitalize">{discount.scope}</td>
                  <td className="text-sm">{formatWindow(discount.startsAt, discount.endsAt)}</td>
                  <td className="text-sm">
                    {formatUsage(discount.usedCount, discount.usageLimit, discount.perCustomerLimit)}
                  </td>
                  <td>
                    <Badge>{discount.isActive ? "Active" : "Inactive"}</Badge>
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
