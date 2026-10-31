import type { ReactNode } from "react";

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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
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
    <section className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {title ? (
        <header className="mb-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)]">
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
  const links = [
    { href: "/", label: "Home" },
    { href: "/admin", label: "Admin" },
    { href: "/staff", label: "Staff" },
    { href: "/portal", label: "Customer portal" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight">Brightloop</span>
            <Badge>{role}</Badge>
          </div>
          <nav className="flex gap-4 text-sm text-[var(--muted)]">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-[var(--foreground)]">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">{children}</main>
    </div>
  );
}
