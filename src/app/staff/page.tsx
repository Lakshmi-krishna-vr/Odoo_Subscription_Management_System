import { Badge, PageHeader, Shell } from "@/components/ui";

export default function StaffPage() {
  return (
    <Shell role="staff">
      <PageHeader
        title="Staff"
        subtitle="Day-to-day operations: customers, subscriptions, invoices, billing and finance."
        right={<Badge>workspace</Badge>}
      />

      <ul className="space-y-3 text-sm">
        <li>
          <a href="/staff/customers" className="font-medium text-[#1f5eff] hover:underline">Customers</a>
          <p className="text-[var(--muted)]">Contacts, payment terms, subscriptions and what each customer still owes.</p>
        </li>
        <li>
          <a href="/staff/quotations" className="font-medium text-[#1f5eff] hover:underline">Quotations</a>
          <p className="text-[var(--muted)]">Start an offer from a template and move it to a live subscription.</p>
        </li>
        <li>
          <a href="/staff/subscriptions" className="font-medium text-[#1f5eff] hover:underline">Subscriptions</a>
          <p className="text-[var(--muted)]">Every subscription, its plan, status and next billing date.</p>
        </li>
        <li>
          <a href="/staff/invoices" className="font-medium text-[#1f5eff] hover:underline">Invoices</a>
          <p className="text-[var(--muted)]">Confirm, cancel, send, print and record payments against an invoice.</p>
        </li>
        <li>
          <a href="/staff/billing" className="font-medium text-[#1f5eff] hover:underline">Billing run</a>
          <p className="text-[var(--muted)]">Preview the invoices that are due, then create them in one go.</p>
        </li>
        <li>
          <a href="/staff/finance" className="font-medium text-[#1f5eff] hover:underline">Finance</a>
          <p className="text-[var(--muted)]">Invoiced, collected, outstanding and the largest overdue accounts.</p>
        </li>
      </ul>
    </Shell>
  );
}
