import { InvoiceStatus, Prisma } from "@prisma/client";
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

const PAGE_SIZE = 25;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INVOICE_STATUSES: string[] = Object.values(InvoiceStatus);

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff]";

type SearchValue = string | string[] | undefined;

interface InvoiceFilters {
  statusFilter: InvoiceStatus | null;
  searchText: string;
  fromDate: string | null;
  toDate: string | null;
}

function firstValue(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function readDate(value: SearchValue): string | null {
  const dateText = firstValue(value);
  return ISO_DATE.test(dateText) ? dateText : null;
}

function readStatus(value: SearchValue): InvoiceStatus | null {
  const statusText = firstValue(value);
  return INVOICE_STATUSES.includes(statusText) ? (statusText as InvoiceStatus) : null;
}

function buildWhere(filters: InvoiceFilters): Prisma.InvoiceWhereInput {
  const { statusFilter, searchText, fromDate, toDate } = filters;
  const invoiceDate: Prisma.DateTimeFilter = {
    ...(fromDate ? { gte: new Date(`${fromDate}T00:00:00Z`) } : {}),
    ...(toDate ? { lte: new Date(`${toDate}T00:00:00Z`) } : {}),
  };

  return {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(fromDate || toDate ? { invoiceDate } : {}),
    ...(searchText
      ? {
          OR: [
            { customer: { companyName: { contains: searchText, mode: "insensitive" } } },
            { number: { contains: searchText, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function pageLink(filters: InvoiceFilters, pageNumber: number): string {
  const query = new URLSearchParams();
  if (filters.statusFilter) query.set("status", filters.statusFilter);
  if (filters.searchText) query.set("q", filters.searchText);
  if (filters.fromDate) query.set("from", filters.fromDate);
  if (filters.toDate) query.set("to", filters.toDate);
  query.set("page", String(pageNumber));
  return `/staff/invoices?${query.toString()}`;
}

export default async function StaffInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string | string[];
    q?: string | string[];
    from?: string | string[];
    to?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const filters: InvoiceFilters = {
    statusFilter: readStatus(params.status),
    searchText: firstValue(params.q).trim(),
    fromDate: readDate(params.from),
    toDate: readDate(params.to),
  };
  const pageNumber = Math.max(1, Number.parseInt(firstValue(params.page), 10) || 1);
  const where = buildWhere(filters);

  const [invoices, totalCount, sums, overdueCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: "desc" },
      skip: (pageNumber - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { customer: true },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where,
      _sum: { total: true, amountPaid: true },
    }),
    prisma.invoice.count({ where: { AND: [where, { status: "overdue" }] } }),
  ]);

  const invoiced = sums._sum.total ?? 0;
  const collected = sums._sum.amountPaid ?? 0;
  const outstanding = invoiced - collected;
  const lastPageNumber = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const firstRowNumber = (pageNumber - 1) * PAGE_SIZE + 1;
  const lastRowNumber = firstRowNumber + invoices.length - 1;

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

      <form method="get" className="flex flex-wrap items-end gap-2">
        <select name="status" defaultValue={filters.statusFilter ?? ""} className={INPUT}>
          <option value="">All statuses</option>
          {INVOICE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          name="q"
          type="search"
          defaultValue={filters.searchText}
          placeholder="Company or invoice number"
          className={INPUT}
        />
        <input name="from" type="date" defaultValue={filters.fromDate ?? ""} className={INPUT} />
        <input name="to" type="date" defaultValue={filters.toDate ?? ""} className={INPUT} />
        <button type="submit" className={SECONDARY}>
          Filter
        </button>
        <a href="/staff/invoices" className="px-2 py-1.5 text-sm font-medium text-[#1f5eff] hover:underline">
          Clear
        </a>
      </form>

      <Card title="Invoices" description="25 per page, newest invoice date first.">
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
                  No invoices match these filters.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => {
                const balance = Math.max(0, invoice.total - invoice.amountPaid);

                return (
                  <tr key={invoice.id}>
                    <td>
                      <a
                        href={`/staff/invoices/${invoice.id}`}
                        className="font-medium text-[#1f5eff] hover:underline"
                      >
                        {invoice.number ?? "Draft"}
                      </a>
                    </td>
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

        {invoices.length > 0 ? (
          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-[var(--muted)]">
              Showing {firstRowNumber}–{lastRowNumber} of {totalCount}
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
