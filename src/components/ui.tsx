import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[2rem]">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </div>
  );
}

export function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {title ? (
        <header className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm text-[var(--muted)]">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[var(--accent)]" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#e9d979] bg-[#fff9d8] px-2.5 py-1 text-[11px] font-semibold capitalize tracking-wide text-[#5d4b00]">
      {children}
    </span>
  );
}

export function Shell({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const links = role === "customer"
    ? [
        { href: "/portal", label: "Overview" },
        { href: "/portal/subscriptions", label: "Subscriptions" },
        { href: "/portal/invoices", label: "Invoices" },
      ]
    : role === "staff"
      ? [
          { href: "/staff", label: "Overview" },
          { href: "/staff/customers", label: "Customers" },
          { href: "/staff/subscriptions", label: "Subscriptions" },
          { href: "/staff/billing", label: "Billing" },
          { href: "/staff/invoices", label: "Invoices" },
          { href: "/staff/finance", label: "Finance" },
        ]
      : role === "admin"
        ? [
            { href: "/admin", label: "Overview" },
            { href: "/admin/products", label: "Products" },
            { href: "/admin/plans", label: "Plans" },
            { href: "/admin/discounts", label: "Discounts" },
            { href: "/staff", label: "Staff workspace" },
          ]
        : [
            { href: "/admin", label: "Admin" },
            { href: "/staff", label: "Staff" },
            { href: "/portal", label: "Customer portal" },
          ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center gap-3">
            <a href={role === "customer" ? "/portal" : role === "staff" ? "/staff" : role === "admin" ? "/admin" : "/"} className="inline-flex items-center gap-2 text-[15px] font-bold tracking-[-0.04em]">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-xs font-black">B</span>
              Brightloop<span className="-ml-2 text-[#d1b600]">.</span>
            </a>
            <Badge>{role}</Badge>
          </div>
          <nav aria-label="Main navigation" className="order-3 flex w-full items-center gap-1 overflow-x-auto pb-0.5 text-sm text-[var(--muted)] sm:order-none sm:w-auto sm:pb-0">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="shrink-0 rounded-full px-3 py-2 font-medium hover:bg-[var(--accent-soft)] hover:text-[var(--foreground)]">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto sm:ml-0">
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] px-3.5 py-2 text-xs font-semibold hover:border-[#c4ac00] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">{children}</main>
    </div>
  );
}
