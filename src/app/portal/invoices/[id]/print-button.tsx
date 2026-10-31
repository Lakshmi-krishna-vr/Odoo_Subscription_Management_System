"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1 text-xs hover:border-[#1f5eff]"
    >
      Print
    </button>
  );
}
