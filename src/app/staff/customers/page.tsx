import type { Prisma } from "@prisma/client";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { customerStandings } from "@/server/customers";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff]";

type SearchValue = string | string[] | undefined;

function firstValue(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function buildWhere(searchText: string): Prisma.CustomerWhereInput {
  if (!searchText) return {};
  return {
    OR: [
      { companyName: { contains: searchText, mode: "insensitive" } },
      { contactName: { contains: searchText, mode: "insensitive" } },
      { email: { contains: searchText, mode: "insensitive" } },
      { code: { contains: searchText, mode: "insensitive" } },
    ],
  };
}

function pageLink(searchText: string, pageNumber: number): string {
  const query = new URLSearchParams();
  if (searchText) query.set("q", searchText);
  query.set("page", String(pageNumber));
  return `/staff/customers?${query.toString()}`;
}

export default async function StaffCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const searchText = firstValue(params.q).trim();
  const pageNumber = Math.max(1, Number.parseInt(firstValue(params.page), 10) || 1);
  const where = buildWhere(searchText);

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { companyName: "asc" },
      skip: (pageNumber - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        companyName: true,
        contactName: true,
        email: true,
        paymentTermsDays: true,
      },
    }),
    prisma.customer.count({ where }),
  ]);
  const standings = await customerStandings(customers.map((customer) => customer.id));

  const lastPageNumber = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRowNumber = (pageNumber - 1) * PAGE_SIZE + 1;
  const lastRowNumber = firstRowNumber + customers.length - 1;

  return (
    <Shell role="staff">
      <PageHeader
        title="Customers"
        subtitle="Who we bill, what they subscribe to and what they still owe."
        right={<Badge>{totalCount} customers</Badge>}
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input
          name="q"
          type="search"
          defaultValue={searchText}
          placeholder="Company, contact, email or code"
          className={`${INPUT} w-72`}
        />
        <button type="submit" className={SECONDARY}>
          Search
        </button>
        <a href="/staff/customers" className="px-2 py-1.5 text-sm font-medium text-[#1f5eff] hover:underline">
          Clear
        </a>
      </form>

      <Card title="Customers" description="25 per page, by company name.">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Company</th>
              <th>Contact</th>
              <th>Email</th>
              <th className="num">Terms</th>
              <th className="num">Active subscriptions</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No customers match this search.
                </td>
              </tr>
            ) : (
              customers.map((customer) => {
                const standing = standings.get(customer.id);

                return (
                  <tr key={customer.id}>
                    <td className="font-mono text-xs">{customer.code}</td>
                    <td>
                      <a
                        href={`/staff/customers/${customer.id}`}
                        className="font-medium text-[#1f5eff] hover:underline"
                      >
                        {customer.companyName}
                      </a>
                    </td>
                    <td>{customer.contactName}</td>
                    <td>{customer.email}</td>
                    <td className="num">{customer.paymentTermsDays} days</td>
                    <td className="num">{standing?.activeSubscriptions ?? 0}</td>
                    <td className="num font-medium">{formatINR(standing?.outstanding ?? 0)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {customers.length > 0 ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-[var(--muted)]">
              Showing {firstRowNumber}–{lastRowNumber} of {totalCount}
            </p>
            <div className="flex items-center gap-4">
              {pageNumber > 1 ? (
                <a
                  href={pageLink(searchText, pageNumber - 1)}
                  className="font-medium text-[#1f5eff] hover:underline"
                >
                  Previous
                </a>
              ) : null}
              {pageNumber < lastPageNumber ? (
                <a
                  href={pageLink(searchText, pageNumber + 1)}
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
