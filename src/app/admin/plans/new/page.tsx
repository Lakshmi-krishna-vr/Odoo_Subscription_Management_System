import { Card, PageHeader, Shell } from "@/components/ui";
import { requireRole } from "@/server/auth";
import { PlanForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewPlanPage() {
  await requireRole(["admin"]);

  return (
    <Shell role="admin">
      <PageHeader
        title="New plan"
        subtitle="Add a subscription plan. Price is entered in rupees and stored as paise."
      />
      <Card
        title="Plan details"
        description="Fields marked * are required. The four policy switches control pause, renew and close for subscriptions on this plan."
      >
        <PlanForm />
      </Card>
    </Shell>
  );
}
