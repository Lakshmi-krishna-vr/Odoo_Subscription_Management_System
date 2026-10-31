import { Badge, PageHeader, Shell } from "@/components/ui";

export default function StaffPage() {
  return (
    <Shell role="staff">
      <PageHeader
        title="Staff"
        subtitle="Day-to-day operations: quotations, subscriptions, billing and payments."
        right={<Badge>shell</Badge>}
      />

      <ul className="space-y-2 text-sm">
        <li><a href="/staff/invoices" className="font-medium text-[#1f5eff] hover:underline">Invoices</a></li>
        <li><a href="/staff/subscriptions" className="font-medium text-[#1f5eff] hover:underline">Subscriptions</a></li>
        <li><a href="/staff/billing" className="font-medium text-[#1f5eff] hover:underline">Billing</a></li>
      </ul>
    </Shell>
  );
}
