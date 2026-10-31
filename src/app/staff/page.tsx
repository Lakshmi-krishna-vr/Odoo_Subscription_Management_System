import { Badge, Card, PageHeader, Shell } from "@/components/ui";

export default function StaffPage() {
  return (
    <Shell role="staff">
      <PageHeader
        title="Staff"
        subtitle="Day-to-day operations: quotations, subscriptions, billing and payments."
        right={<Badge>shell</Badge>}
      />

      <Card title="What this surface will do">
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li>Start a quotation from a template and turn it into a subscription.</li>
          <li>Run billing for every subscription that is due, preview first, then commit.</li>
          <li>Confirm, cancel, send and print invoices; record payments against them.</li>
          <li>See what is paid and what is outstanding, so overdue accounts get chased.</li>
        </ul>
      </Card>
    </Shell>
  );
}
