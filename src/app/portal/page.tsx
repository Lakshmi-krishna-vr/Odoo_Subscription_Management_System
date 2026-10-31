import { Badge, Card, PageHeader, Shell } from "@/components/ui";

export default function PortalPage() {
  return (
    <Shell role="customer">
      <PageHeader
        title="Customer portal"
        subtitle="A customer sees their own subscriptions and invoices, and nothing else."
        right={<Badge>shell</Badge>}
      />

      <Card title="What this surface will do">
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li>Browse the plans that are on sale and subscribe to one.</li>
          <li>See active and past subscriptions with start, expiry and renewal dates.</li>
          <li>Download or print their own invoices, and see what is still due.</li>
          <li>Ask for a pause, renewal or cancellation instead of emailing the team.</li>
        </ul>
      </Card>
    </Shell>
  );
}
