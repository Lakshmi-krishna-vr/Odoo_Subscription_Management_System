const TABS = [
  { href: "/portal", label: "Overview", key: "overview" },
  { href: "/portal/subscriptions", label: "Subscriptions", key: "subscriptions" },
  { href: "/portal/invoices", label: "Invoices", key: "invoices" },
];

export function PortalTabs({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 border-b border-[var(--border)] pb-0 text-sm">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <a
            key={tab.key}
            href={tab.href}
            className={
              isActive
                ? "-mb-px border-b-2 border-[#1f5eff] px-3 py-2 font-medium text-[var(--foreground)]"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-[var(--muted)] hover:text-[var(--foreground)]"
            }
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
