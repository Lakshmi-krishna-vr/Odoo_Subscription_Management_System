import type { Metadata } from "next";
import { Badge, Card, PageHeader, Shell } from "@/components/ui";

const LINKS = [
  { href: "/staff/customers", label: "Customers", body: "Contacts, payment terms, subscriptions and what each customer still owes." },
  { href: "/staff/subscriptions/new", label: "New subscription", body: "Start an offer from a quotation template and move it to a live subscription." },
  { href: "/staff/subscriptions", label: "Subscriptions", body: "Every subscription, its plan, status and next billing date." },
  { href: "/staff/invoices", label: "Invoices", body: "Confirm, cancel, send, print and record payments against an invoice." },
  { href: "/staff/billing", label: "Billing run", body: "Preview the invoices that are due, then create them in one go." },
  { href: "/staff/finance", label: "Finance", body: "Invoiced, collected, outstanding and the largest overdue accounts." },
];

export const metadata: Metadata = { title: "Staff · Brightloop" };

export default function StaffPage() {
  return (
    <Shell role="staff">
      <PageHeader
        title="Staff"
        subtitle="Day-to-day operations: customers, subscriptions, invoices, billing and finance."
        right={<Badge>workspace</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            <Card title={link.label}>
              <p className="text-sm text-[var(--muted)]">{link.body}</p>
            </Card>
          </a>
        ))}
      </div>
    </Shell>
  );
}
