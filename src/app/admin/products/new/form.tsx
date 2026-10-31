"use client";

import { useActionState, useState } from "react";
import { createProductAction, type ProductState } from "../actions";

// ── style constants (matching billing-panel.tsx pattern) ──────────────────────
const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SELECT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--muted)] hover:border-[#1f5eff] hover:text-[var(--foreground)]";
const FIELD_ERR = "mt-1 text-xs text-red-600";

// ── types ─────────────────────────────────────────────────────────────────────
interface TaxOption {
  id: string;
  name: string;
  rateBp: number;
}

interface VariantRow {
  attribute: string;
  value: string;
  extraPrice: string;
}

// ── component ─────────────────────────────────────────────────────────────────
export function ProductForm({ taxes }: { taxes: TaxOption[] }) {
  const [state, dispatch, pending] = useActionState<ProductState, FormData>(
    createProductAction,
    {},
  );

  const [variants, setVariants] = useState<VariantRow[]>([]);

  function addVariant() {
    setVariants((prev) => [...prev, { attribute: "", value: "", extraPrice: "" }]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariant(index: number, field: keyof VariantRow, value: string) {
    setVariants((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <form action={dispatch} className="space-y-5">
      {/* Top-level error */}
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}

      {/* ── Product name ─────────────────────────────────────────────── */}
      <div>
        <label htmlFor="prod-name" className={LABEL}>
          Product name <span className="text-red-500">*</span>
        </label>
        <input
          id="prod-name"
          name="name"
          type="text"
          placeholder="e.g. Brightloop ERP"
          autoComplete="off"
          className={INPUT}
        />
        {state.fieldErrors?.name ? (
          <p className={FIELD_ERR}>{state.fieldErrors.name}</p>
        ) : null}
      </div>

      {/* ── Type ─────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="prod-type" className={LABEL}>
          Type <span className="text-red-500">*</span>
        </label>
        <select id="prod-type" name="type" defaultValue="software" className={SELECT}>
          <option value="software">Software</option>
          <option value="add-on">Add-on</option>
          <option value="service">Service</option>
        </select>
        {state.fieldErrors?.type ? (
          <p className={FIELD_ERR}>{state.fieldErrors.type}</p>
        ) : null}
      </div>

      {/* ── Prices ───────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prod-sales-price" className={LABEL}>
            Sales price (₹) <span className="text-red-500">*</span>
          </label>
          <input
            id="prod-sales-price"
            name="salesPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={INPUT}
          />
          {state.fieldErrors?.salesPrice ? (
            <p className={FIELD_ERR}>{state.fieldErrors.salesPrice}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="prod-cost-price" className={LABEL}>
            Cost price (₹)
          </label>
          <input
            id="prod-cost-price"
            name="costPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={INPUT}
          />
          {state.fieldErrors?.costPrice ? (
            <p className={FIELD_ERR}>{state.fieldErrors.costPrice}</p>
          ) : null}
        </div>
      </div>

      {/* ── Tax ──────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="prod-tax" className={LABEL}>
          Tax
        </label>
        <select id="prod-tax" name="taxId" defaultValue="" className={SELECT}>
          <option value="">No tax</option>
          {taxes.map((tax) => (
            <option key={tax.id} value={tax.id}>
              {tax.name} ({(tax.rateBp / 100).toFixed(0)}%)
            </option>
          ))}
        </select>
        {state.fieldErrors?.taxId ? (
          <p className={FIELD_ERR}>{state.fieldErrors.taxId}</p>
        ) : null}
      </div>

      {/* ── Notes ────────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="prod-notes" className={LABEL}>
          Notes
        </label>
        <textarea
          id="prod-notes"
          name="notes"
          rows={3}
          placeholder="Optional internal notes"
          className={INPUT + " resize-y"}
        />
      </div>

      {/* ── Is add-on ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <input
          id="prod-is-addon"
          name="isAddon"
          type="checkbox"
          className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
        />
        <label htmlFor="prod-is-addon" className="text-sm">
          This is an add-on product
        </label>
      </div>

      {/* ── Variants ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--border)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">Variants</p>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              Attach attributes (e.g. Brand: Odoo) with an optional extra price.
            </p>
          </div>
          <button type="button" onClick={addVariant} className={SECONDARY}>
            + Add variant
          </button>
        </div>

        {state.fieldErrors?.variants ? (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.fieldErrors.variants}
          </p>
        ) : null}

        {variants.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">
            No variants. Click &ldquo;Add variant&rdquo; to attach one.
          </p>
        ) : (
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1fr_140px_32px] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              <span>Attribute</span>
              <span>Value</span>
              <span>Extra price (₹)</span>
              <span />
            </div>

            {variants.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_140px_32px] items-center gap-2"
              >
                <input
                  type="text"
                  name="variantAttribute"
                  value={row.attribute}
                  onChange={(e) => updateVariant(i, "attribute", e.target.value)}
                  placeholder="e.g. Brand"
                  className={INPUT}
                />
                <input
                  type="text"
                  name="variantValue"
                  value={row.value}
                  onChange={(e) => updateVariant(i, "value", e.target.value)}
                  placeholder="e.g. Odoo"
                  className={INPUT}
                />
                <input
                  type="number"
                  name="variantExtraPrice"
                  value={row.extraPrice}
                  onChange={(e) => updateVariant(i, "extraPrice", e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  aria-label={`Remove variant row ${i + 1}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] hover:border-red-300 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Form actions ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <a
          href="/admin/products"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to products
        </a>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save product"}
        </button>
      </div>
    </form>
  );
}
