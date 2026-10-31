export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <a href="/" className="text-base font-semibold tracking-tight">
            Brightloop
          </a>
          <p className="mt-1 text-xs text-[var(--muted)]">Subscription management</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {children}
        </div>
      </div>
    </div>
  );
}
