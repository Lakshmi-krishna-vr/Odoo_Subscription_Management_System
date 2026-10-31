import { Card, PageHeader, Shell } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { DiscountForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewDiscountPage() {
  await requireRole(["admin"]);

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="New discount"
        subtitle="Add a discount rule. Fixed amounts are stored as paise; percentages as basis points."
      />
      <Card
        title="Discount details"
        description="Fields marked * are required. Product-scope rules apply to selected catalogue items; subscription-scope rules apply to the whole bill."
      >
        <DiscountForm products={products} />
      </Card>
    </Shell>
  );
}
