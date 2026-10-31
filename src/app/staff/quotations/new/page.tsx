import { Card, PageHeader, Shell } from "@/components/ui";
import { todayIso } from "@/core/periods";
import { prisma } from "@/server/db";
import { NewQuotationForm } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const [customers, templates] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, code: true },
    }),
    prisma.quotationTemplate.findMany({
      where: { isActive: true },
      include: { plan: true, lines: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <Shell role="staff">
      <PageHeader
        title="New quotation"
        subtitle="Start from a template — the plan and the lines come with it, and the engine prices it."
      />

      <Card title="Quotation details">
        <NewQuotationForm
          today={todayIso()}
          customers={customers.map((customer) => ({
            id: customer.id,
            label: `${customer.companyName} (${customer.code})`,
          }))}
          templates={templates.map((template) => ({
            id: template.id,
            label: `${template.name} — ${template.plan.name}, ${template.lines.length} line${template.lines.length === 1 ? "" : "s"}, valid ${template.validityDays} days`,
          }))}
        />
      </Card>

      <p className="text-xs text-[var(--muted)]">
        The quotation is created as a draft. Nothing is billed until it is confirmed and activated.
      </p>
    </Shell>
  );
}
