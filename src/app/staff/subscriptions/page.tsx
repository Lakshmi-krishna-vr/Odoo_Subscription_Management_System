import type { Metadata } from "next";
import { Prisma, SubStatus } from "@prisma/client";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { prisma } from "@/server/db";
import { SUBSCRIPTION_STATUS_LABEL } from "@/server/subscriptions";

// Read-only page: the build must never hit the database.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Subscriptions · Brightloop" };

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const PAGE_SIZE = 25;
const SUBSCRIPTION_STATUSES: string[] = Object.values(SubStatus);

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff]";

type SearchValue = string | string[] | undefined;

interface SubscriptionFilters {
  statusFilter: SubStatus | null;
  searchText: string;
}

function firstValue(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function readStatus(value: SearchValue): SubStatus | null {
  const statusText = firstValue(value);
  return SUBSCRIPTION_STATUSES.includes(statusText) ? (statusText as SubStatus) : null;
}

function buildWhere(filters: SubscriptionFilters): Prisma.SubscriptionWhereInput {
  const { statusFilter, searchText } = filters;
  return {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(searchText
      ? {
          OR: [
            { number: { contains: searchText, mode: "insensitive" } },
            { customer: { companyName: { contains: searchText, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

function pageLink(filters: SubscriptionFilters, pageNumber: number): string {
  const query = new URLSearchParams();
  if (filters.statusFilter) query.set("status", filters.statusFilter);
  if (filters.searchText) query.set("q", filters.searchText);
  query.set("page", String(pageNumber));
  return `/staff/subscriptions?${query.toString()}`;
}

export default async function StaffSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const filters: SubscriptionFilters = {
    statusFilter: readStatus(params.status),
    searchText: firstValue(params.q).trim(),
  };
  const pageNumber = Math.max(1, Number.parseInt(firstValue(params.page), 10) || 1);
  const where = buildWhere(filters);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [subscriptions, total, dueToday] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { nextBillingDate: "asc" },
      skip: (pageNumber - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        number: true,
        status: true,
        startDate: true,
        expiryDate: true,
        nextBillingDate: true,
        customer: { select: { companyName: true } },
        plan: { select: { name: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.subscription.count({ where }),
    prisma.subscription.count({
      where: { AND: [where, { nextBillingDate: { lte: today } }] },
    }),
  ]);

  const lastPageNumber = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRowNumber = (pageNumber - 1) * PAGE_SIZE + 1;
  const lastRowNumber = firstRowNumber + subscriptions.length - 1;

  return (
    <Shell role="staff">
      <PageHeader
        title="Subscriptions"
        subtitle="Every subscription, soonest billing date first."
        right={
          <div className="flex items-center gap-3">
            <Badge>{total} total</Badge>
            <a
              href="/staff/subscriptions/new"
              className="rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8]"
            >
              New subscription
            </a>
          </div>
        }
      />

      <p className="text-sm text-[var(--muted)]">
        <span className="font-medium text-[var(--foreground)]">{total}</span>{" "}
        subscription{total === 1 ? "" : "s"} in total ·{" "}
        <span className="font-medium text-[var(--foreground)]">{dueToday}</span>{" "}
        due for billing today or earlier
      </p>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <select name="status" defaultValue={filters.statusFilter ?? ""} className={INPUT}>
          <option value="">All statuses</option>
          {SUBSCRIPTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SUBSCRIPTION_STATUS_LABEL[status as SubStatus]}
            </option>
          ))}
        </select>
        <input
          name="q"
          type="search"
          defaultValue={filters.searchText}
          placeholder="Number or company"
          className={INPUT}
        />
        <button type="submit" className={SECONDARY}>
          Filter
        </button>
        <a href="/staff/subscriptions" className="px-2 py-1.5 text-sm font-medium text-[#1f5eff] hover:underline">
          Clear
        </a>
      </form>

      <Card title="Subscriptions" description="25 per page, soonest billing date first.">
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
                  No subscriptions match these filters.
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
                  <td>{subscription.customer.companyName}</td>
                  <td>{subscription.plan.name}</td>
                  <td>
                    <Badge>{SUBSCRIPTION_STATUS_LABEL[subscription.status]}</Badge>
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

        {subscriptions.length > 0 ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-[var(--muted)]">
              Showing {firstRowNumber}–{lastRowNumber} of {total}
            </p>
            <div className="flex items-center gap-4">
              {pageNumber > 1 ? (
                <a
                  href={pageLink(filters, pageNumber - 1)}
                  className="font-medium text-[#1f5eff] hover:underline"
                >
                  Previous
                </a>
              ) : null}
              {pageNumber < lastPageNumber ? (
                <a
                  href={pageLink(filters, pageNumber + 1)}
                  className="font-medium text-[#1f5eff] hover:underline"
                >
                  Next
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </Shell>
  );
}
