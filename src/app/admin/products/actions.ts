"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { rupeesToPaise } from "@/core/money";
import { MAX_PAISE } from "@/contracts";

export interface ProductState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const VALID_TYPES = ["software", "add-on", "service"] as const;
type ProductType = (typeof VALID_TYPES)[number];

type ParseOk = { paise: number };
type ParseErr = { error: string };

function parseRupees(raw: string, label: string): ParseOk | ParseErr {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { error: `${label} must be a valid number.` };
  }
  if (n < 0) return { error: `${label} cannot be negative.` };
  const paise = rupeesToPaise(n);
  if (paise > MAX_PAISE) {
    return { error: `${label} exceeds the maximum allowed value (₹${MAX_PAISE / 100}).` };
  }
  return { paise };
}

interface ValidatedVariant {
  attribute: string;
  value: string;
  extraPrice: number;
}

export async function createProductAction(
  _prev: ProductState,
  formData: FormData,
): Promise<ProductState> {
  await requireRole(["admin"]);

  const fieldErrors: Record<string, string> = {};

  // ── basic fields ─────────────────────────────────────────────────────────
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fieldErrors.name = "Product name is required.";

  const type = String(formData.get("type") ?? "").trim();
  if (!VALID_TYPES.includes(type as ProductType)) {
    fieldErrors.type = "Type must be one of: software, add-on, service.";
  }

  // Sales price is required; cost price defaults to 0
  const salesPriceRaw = String(formData.get("salesPrice") ?? "").trim();
  const costPriceRaw = String(formData.get("costPrice") ?? "").trim();

  if (salesPriceRaw === "") {
    fieldErrors.salesPrice = "Sales price is required.";
  }
  const salesResult = salesPriceRaw !== "" ? parseRupees(salesPriceRaw, "Sales price") : null;
  if (salesResult && "error" in salesResult) fieldErrors.salesPrice = salesResult.error;

  const costResult = parseRupees(costPriceRaw === "" ? "0" : costPriceRaw, "Cost price");
  if ("error" in costResult) fieldErrors.costPrice = costResult.error;

  // ── tax validation ────────────────────────────────────────────────────────
  const taxIdRaw = String(formData.get("taxId") ?? "").trim();
  const taxId = taxIdRaw !== "" ? taxIdRaw : null;

  if (taxId !== null) {
    const tax = await prisma.tax.findFirst({ where: { id: taxId, isActive: true } });
    if (!tax) {
      fieldErrors.taxId = "Selected tax does not exist or is not active.";
    }
  }

  // ── optional fields ───────────────────────────────────────────────────────
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isAddon = formData.get("isAddon") === "on";

  // ── variants ──────────────────────────────────────────────────────────────
  const attrList = formData.getAll("variantAttribute").map((v) => String(v).trim());
  const valueList = formData.getAll("variantValue").map((v) => String(v).trim());
  const extraList = formData.getAll("variantExtraPrice").map((v) => String(v).trim());

  const variants: ValidatedVariant[] = [];
  const seen = new Set<string>();
  const variantErrors: string[] = [];

  for (let i = 0; i < attrList.length; i++) {
    const attr = attrList[i];
    const val = valueList[i] ?? "";
    const extraRaw = extraList[i] ?? "";

    // Completely blank row → silently skip
    if (attr === "" && val === "") continue;

    // Partial row → validation error
    if (attr === "" && val !== "") {
      variantErrors.push(`Row ${i + 1}: attribute name is missing.`);
      continue;
    }
    if (attr !== "" && val === "") {
      variantErrors.push(`Row ${i + 1}: value is missing.`);
      continue;
    }

    // Extra price (optional, defaults to 0)
    const extraResult = parseRupees(extraRaw === "" ? "0" : extraRaw, `Row ${i + 1} extra price`);
    if ("error" in extraResult) {
      variantErrors.push(`Row ${i + 1}: ${extraResult.error}`);
      continue;
    }

    // Deduplicate by attribute + value (keep first occurrence)
    const key = `${attr}\x00${val}`;
    if (seen.has(key)) continue;
    seen.add(key);

    variants.push({ attribute: attr, value: val, extraPrice: extraResult.paise });
  }

  if (variantErrors.length > 0) {
    fieldErrors.variants = variantErrors.join(" ");
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // ── persist ───────────────────────────────────────────────────────────────
  // salesResult and costResult are guaranteed ParseOk here (fieldErrors was empty)
  const salesPaise = (salesResult as ParseOk).paise;
  const costPaise = (costResult as ParseOk).paise;

  try {
    await prisma.product.create({
      data: {
        id: randomUUID(),
        name,
        type,
        salesPrice: salesPaise,
        costPrice: costPaise,
        taxId,
        notes,
        isAddon,
        variants: {
          create: variants.map((v) => ({
            id: randomUUID(),
            attribute: v.attribute,
            value: v.value,
            extraPrice: v.extraPrice,
          })),
        },
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create product. Please try again.",
    };
  }

  // redirect() throws NEXT_REDIRECT — must be outside try/catch
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
