"use client";

import { useActionState, useState } from "react";
import { createDiscountAction, type DiscountState } from "../actions";

const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";
const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const SELECT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const FIELD_ERR = "mt-1 text-xs text-red-600";

interface ProductOption {
  id: string;
  name: string;
}

export function DiscountForm({ products }: { products: ProductOption[] }) {
  const [state, dispatch, pending] = useActionState<DiscountState, FormData>(
    createDiscountAction,
    {},
  );
  const [type, setType] = useState<"fixed" | "percent">("percent");
  const [scope, setScope] = useState<"products" | "subscription">("subscription");

  return (
    <form action={dispatch} className="space-y-5">
      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}

      <div>
        <label htmlFor="disc-name" className={LABEL}>
          Discount name <span className="text-red-500">*</span>
        </label>
        <input
          id="disc-name"
          name="name"
          type="text"
          placeholder="e.g. Brightloop Launch Offer"
          autoComplete="off"
          className={INPUT}
        />
        {state.fieldErrors?.name ? <p className={FIELD_ERR}>{state.fieldErrors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="disc-code" className={LABEL}>
          Discount code
        </label>
        <input
          id="disc-code"
          name="code"
          type="text"
          placeholder="e.g. LAUNCH15"
          autoComplete="off"
          className={INPUT}
        />
        {state.fieldErrors?.code ? <p className={FIELD_ERR}>{state.fieldErrors.code}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="disc-type" className={LABEL}>
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="disc-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as "fixed" | "percent")}
            className={SELECT}
          >
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
          {state.fieldErrors?.type ? <p className={FIELD_ERR}>{state.fieldErrors.type}</p> : null}
        </div>
        <div>
          <label htmlFor="disc-value" className={LABEL}>
            {type === "percent" ? "Value (%)" : "Value (₹)"} <span className="text-red-500">*</span>
          </label>
          <input
            id="disc-value"
            name="value"
            type="number"
            min={type === "percent" ? "0.01" : "0.01"}
            max={type === "percent" ? "100" : undefined}
            step={type === "percent" ? "0.01" : "0.01"}
            placeholder={type === "percent" ? "15" : "200.00"}
            className={INPUT}
          />
          {state.fieldErrors?.value ? <p className={FIELD_ERR}>{state.fieldErrors.value}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="disc-scope" className={LABEL}>
          Scope <span className="text-red-500">*</span>
        </label>
        <select
          id="disc-scope"
          name="scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as "products" | "subscription")}
          className={SELECT}
        >
          <option value="subscription">Subscription</option>
          <option value="products">Products</option>
        </select>
        {state.fieldErrors?.scope ? <p className={FIELD_ERR}>{state.fieldErrors.scope}</p> : null}
      </div>

      {scope === "products" ? (
        <div className="rounded-lg border border-[var(--border)] p-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            Products <span className="text-red-500">*</span>
          </p>
          <p className="mt-0.5 mb-3 text-[11px] text-[var(--muted)]">
            Choose the catalogue items this rule applies to.
          </p>
          {state.fieldErrors?.productIds ? (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              {state.fieldErrors.productIds}
            </p>
          ) : null}
          {products.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No active products in the catalogue.</p>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div key={product.id} className="flex items-center gap-2">
                  <input
                    id={`disc-product-${product.id}`}
                    name="productIds"
                    type="checkbox"
                    value={product.id}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[#1f5eff]"
                  />
                  <label htmlFor={`disc-product-${product.id}`} className="text-sm">
                    {product.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="disc-min-purchase" className={LABEL}>
            Minimum purchase (₹)
          </label>
          <input
            id="disc-min-purchase"
            name="minPurchase"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            className={INPUT}
          />
          {state.fieldErrors?.minPurchase ? (
            <p className={FIELD_ERR}>{state.fieldErrors.minPurchase}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="disc-min-qty" className={LABEL}>
            Minimum quantity
          </label>
          <input
            id="disc-min-qty"
            name="minQuantity"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            className={INPUT}
          />
          {state.fieldErrors?.minQuantity ? (
            <p className={FIELD_ERR}>{state.fieldErrors.minQuantity}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="disc-starts" className={LABEL}>
            Start date
          </label>
          <input id="disc-starts" name="startsAt" type="date" className={INPUT} />
          {state.fieldErrors?.startsAt ? (
            <p className={FIELD_ERR}>{state.fieldErrors.startsAt}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="disc-ends" className={LABEL}>
            End date
          </label>
          <input id="disc-ends" name="endsAt" type="date" className={INPUT} />
          {state.fieldErrors?.endsAt ? <p className={FIELD_ERR}>{state.fieldErrors.endsAt}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="disc-usage" className={LABEL}>
            Usage limit
          </label>
          <input
            id="disc-usage"
            name="usageLimit"
            type="number"
            min="1"
            step="1"
            placeholder="Unlimited"
            className={INPUT}
          />
          {state.fieldErrors?.usageLimit ? (
            <p className={FIELD_ERR}>{state.fieldErrors.usageLimit}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="disc-per-customer" className={LABEL}>
            Per-customer limit
          </label>
          <input
            id="disc-per-customer"
            name="perCustomerLimit"
            type="number"
            min="1"
            step="1"
            placeholder="Unlimited"
            className={INPUT}
          />
          {state.fieldErrors?.perCustomerLimit ? (
            <p className={FIELD_ERR}>{state.fieldErrors.perCustomerLimit}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] pt-4">
        <a
          href="/admin/discounts"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Back to discounts
        </a>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save discount"}
        </button>
      </div>
    </form>
  );
}
