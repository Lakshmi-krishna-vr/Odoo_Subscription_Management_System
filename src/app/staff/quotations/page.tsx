import { Badge, Card, PageHeader, Shell } from "@/components/ui";
import { formatINR } from "@/core/money";
import { prisma } from "@/server/db";

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

export default async function QuotationsPage() {
  const [quotes, templates] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: { in: ["draft", "quotation", "confirmed"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { customer: true, plan: true, _count: { select: { lines: true } } },
    }),
    prisma.quotationTemplate.findMany({
      where: { isActive: true },
      include: { plan: true },
    }),
  ]);

  const byStatus = {
    draft: quotes.filter((quote) => quote.status === "draft").length,
    quotation: quotes.filter((quote) => quote.status === "quotation").length,
    confirmed: quotes.filter((quote) => quote.status === "confirmed").length,
  };

  return (
    <Shell role="staff">
      <PageHeader
        title="Quotations"
        subtitle="Offers on their way to becoming live subscriptions."
        right={
          <a
            href="/staff/quotations/new"
            className="rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8]"
          >
            New quotation
          </a>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Draft</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{byStatus.draft}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Quotation sent</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{byStatus.quotation}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Confirmed</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{byStatus.confirmed}</div>
        </div>
      </div>

      <Card
        title="Open quotations"
        description={`${quotes.length} subscriptions that are not active yet · ${templates.length} template${templates.length === 1 ? "" : "s"} available`}
      >
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Start</th>
              <th className="num">Lines</th>
              <th className="num">Plan price</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-[var(--muted)]">
                  No open quotations. Start one from a template.
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id}>
                  <td className="font-mono text-xs">
                    <a className="text-[#1f5eff] hover:underline" href={`/staff/quotations/${quote.id}`}>
                      {quote.number}
                    </a>
                  </td>
                  <td>{quote.customer.companyName}</td>
                  <td>{quote.plan.name}</td>
                  <td>
                    <Badge>{quote.status}</Badge>
                  </td>
                  <td>{formatDate(quote.startDate)}</td>
                  <td className="num">{quote._count.lines}</td>
                  <td className="num">{formatINR(quote.plan.price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
