import { Badge, Card, PageHeader, Shell } from "@/components/ui";

const surfaces = [
  {
    href: "/admin",
    title: "Admin",
    body: "Products, plans, taxes and discount rules. Only the admin can add staff.",
  },
  {
    href: "/staff",
    title: "Staff",
    body: "Quotations, subscriptions, billing runs, invoices and payments.",
  },
  {
    href: "/portal",
    title: "Customer portal",
    body: "Customers see their own subscriptions and invoices, and nothing else.",
  },
];

export default function HomePage() {
  return (
    <Shell role="overview">
      <PageHeader
        title="Subscription management"
        subtitle="Plans, subscriptions and recurring billing in one place."
        right={<Badge>foundation build</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {surfaces.map((surface) => (
          <a key={surface.href} href={surface.href}>
            <Card title={surface.title}>
              <p className="text-sm text-[var(--muted)]">{surface.body}</p>
            </Card>
          </a>
        ))}
      </div>

      <Card title="What is running today">
        <ul className="space-y-2 text-sm text-[var(--muted)]">
          <li>
            The pricing engine is live: catalogue price + variant + discount + tax, in integer
            paise, covered by unit tests.
          </li>
          <li>
            Billing period maths and the subscription status rules are in place, including the
            month-end clamp (31 Jan → 28 Feb → 31 Mar).
          </li>
          <li>The database schema and the three role surfaces are next.</li>
        </ul>
      </Card>
    </Shell>
  );
}
