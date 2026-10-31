import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";
import { Card, PageHeader, Shell } from "@/components/ui";
import { ProductForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireRole(["admin"]);

  const taxes = await prisma.tax.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <Shell role="admin">
      <PageHeader
        title="New product"
        subtitle="Add a product to the catalogue. Prices are entered in rupees and stored as paise."
      />
      <Card
        title="Product details"
        description="Fields marked * are required. Variants let you attach attributes like Brand or Storage with an optional extra price."
      >
        <ProductForm taxes={taxes} />
      </Card>
    </Shell>
  );
}
