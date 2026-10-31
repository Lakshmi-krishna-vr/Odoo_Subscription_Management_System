"use client";

import { useActionState, useState } from "react";
import { changeLinesAction, type SubscriptionActionState } from "./actions";

const INPUT =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1f5eff]";
const PRIMARY =
  "rounded-lg bg-[#1f5eff] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60";
const SECONDARY =
  "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium hover:border-[#1f5eff] disabled:opacity-60";

export interface EditableLine {
  id: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
}

export interface ProductOption {
  id: string;
  name: string;
}

export interface VariantOption {
  id: string;
  productId: string;
  label: string;
}

export function LinesEditor({
  subscriptionId,
  lines,
  products,
  variants,
}: {
  subscriptionId: string;
  lines: EditableLine[];
  products: ProductOption[];
  variants: VariantOption[];
}) {
  const [changeState, changeRun, changing] = useActionState<SubscriptionActionState, FormData>(
    changeLinesAction,
    {},
  );
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [pendingForm, setPendingForm] = useState<string | null>(null);
  const isPending = (formKey: string) => changing && pendingForm === formKey;
  const productVariants = variants.filter((variant) => variant.productId === productId);
  const canRemove = lines.length > 1;

  return (
    <div className="space-y-3">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Variant</th>
            <th className="num">Qty</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={`${line.id}-${line.quantity}`}>
              <td>{line.productName}</td>
              <td>{line.variantLabel ?? "—"}</td>
              <td className="num">
                <form
                  action={changeRun}
                  onSubmit={() => setPendingForm(`quantity-${line.id}`)}
                  className="flex items-center justify-end gap-2"
                >
                  <input type="hidden" name="subscriptionId" value={subscriptionId} />
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="change" value="quantity" />
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    step={1}
                    required
                    defaultValue={line.quantity}
                    aria-label={`Quantity for ${line.productName}`}
                    className={`${INPUT} w-20 text-right`}
                  />
                  <button type="submit" className={SECONDARY} disabled={changing}>
                    {isPending(`quantity-${line.id}`) ? "Saving…" : "Save"}
                  </button>
                </form>
              </td>
              <td className="num">
                <form action={changeRun} onSubmit={() => setPendingForm(`remove-${line.id}`)}>
                  <input type="hidden" name="subscriptionId" value={subscriptionId} />
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="change" value="remove" />
                  <button type="submit" className={SECONDARY} disabled={changing || !canRemove}>
                    {isPending(`remove-${line.id}`) ? "Removing…" : "Remove"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form
        action={changeRun}
        onSubmit={() => setPendingForm("add")}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <input type="hidden" name="change" value="add" />
        <select
          name="productId"
          required
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          aria-label="Product"
          className={INPUT}
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
        <select key={productId} name="variantId" defaultValue="" aria-label="Variant" className={INPUT}>
          <option value="">No variant</option>
          {productVariants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label}
            </option>
          ))}
        </select>
        <input
          name="quantity"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={1}
          aria-label="Quantity"
          className={`${INPUT} w-20 text-right`}
        />
        <button type="submit" className={PRIMARY} disabled={changing || products.length === 0}>
          {isPending("add") ? "Adding…" : "Add line"}
        </button>
      </form>

      {changeState.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{changeState.error}</p>
      ) : null}
      {changeState.message && !changeState.error ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {changeState.message}
        </p>
      ) : null}
    </div>
  );
}
