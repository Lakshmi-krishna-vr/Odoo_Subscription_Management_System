import type { Metadata } from "next";
import { Card, PageHeader, Shell } from "@/components/ui";
import { todayIso } from "@/core/periods";
import { prisma } from "@/server/db";
import { NewSubscriptionForm, type TemplateOption } from "./form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New subscription · Brightloop" };

export default async function NewSubscriptionPage() {
  const [customers, templates] = await Promise.all([
    prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    prisma.quotationTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { plan: true, lines: true },
    }),
  ]);

  const templateLines = templates.flatMap((template) => template.lines);
  const variantIds = templateLines
    .map((line) => line.variantId)
    .filter((variantId): variantId is string => variantId !== null);
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: templateLines.map((line) => line.productId) } },
      select: { id: true, name: true },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, attribute: true, value: true },
    }),
  ]);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const variantLabels = new Map(
    variants.map((variant) => [variant.id, `${variant.attribute}: ${variant.value}`]),
  );

  const templateOptions: TemplateOption[] = templates.map((template) => ({
    id: template.id,
    name: template.name,
    planName: template.plan.name,
    lines: template.lines.map((line) => ({
      id: line.id,
      productName: productNames.get(line.productId) ?? "Unknown product",
      variantLabel: line.variantId ? (variantLabels.get(line.variantId) ?? null) : null,
      quantity: line.quantity,
    })),
  }));

  return (
    <Shell role="staff">
      <PageHeader
        title="New subscription"
        subtitle="Start from a quotation template. The subscription is created as a draft."
        right={
          <a href="/staff/subscriptions" className="text-sm font-medium text-[#1f5eff] hover:underline">
            Back to subscriptions
          </a>
        }
      />

      <Card>
        <NewSubscriptionForm customers={customers} templates={templateOptions} today={todayIso()} />
      </Card>
    </Shell>
  );
}
