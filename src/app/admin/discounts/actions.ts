"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { MAX_PAISE } from "@/contracts";
import { rupeesToPaise } from "@/core/money";
import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";

export interface DiscountState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const DISCOUNT_TYPES = ["fixed", "percent"] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

const DISCOUNT_SCOPES = ["products", "subscription"] as const;
type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ParseOk = { paise: number };
type ParseErr = { error: string };

function parseRupees(
  raw: string,
  label: string,
  options: { minExclusive?: number } = {},
): ParseOk | ParseErr {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { error: `${label} must be a valid number.` };
  }
  if (n < 0) return { error: `${label} cannot be negative.` };
  if (options.minExclusive !== undefined && n <= options.minExclusive) {
    return { error: `${label} must be greater than ₹${options.minExclusive}.` };
  }
  const paise = rupeesToPaise(n);
  if (options.minExclusive !== undefined && paise <= 0) {
    return { error: `${label} must be greater than ₹0.` };
  }
  if (paise > MAX_PAISE) {
    return { error: `${label} exceeds the maximum allowed value (₹${MAX_PAISE / 100}).` };
  }
  return { paise };
}

function parsePercent(raw: string): { bp: number } | { error: string } {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { error: "Percentage must be a valid number." };
  }
  if (n <= 0 || n > 100) {
    return { error: "Percentage must be greater than 0 and at most 100." };
  }
  return { bp: Math.round(n * 100) };
}

function parsePositiveInt(raw: string, label: string): { value: number } | { error: string } {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { error: `${label} must be a whole number of at least 1.` };
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) {
    return { error: `${label} must be a whole number of at least 1.` };
  }
  return { value: n };
}

function parseOptionalPositiveInt(
  raw: string,
  label: string,
): { value: number | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  const parsed = parsePositiveInt(trimmed, label);
  if ("error" in parsed) return parsed;
  return { value: parsed.value };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Strict calendar date. Rejects 2026-02-30. Valid dates are stored at UTC midnight. */
function parseOptionalUtcDate(
  raw: string,
  label: string,
): { date: Date | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { date: null };

  const match = ISO_DATE.exec(trimmed);
  if (!match) {
    return { error: `${label} must be a valid date (YYYY-MM-DD).` };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: `${label} is not a valid calendar date.` };
  }

  return { date };
}

export async function createDiscountAction(
  _prev: DiscountState,
  formData: FormData,
): Promise<DiscountState> {
  await requireRole(["admin"]);

  const fieldErrors: Record<string, string> = {};

  const name = String(formData.get("name") ?? "").trim();
  if (!name) fieldErrors.name = "Discount name is required.";

  const codeRaw = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = codeRaw === "" ? null : codeRaw;

  const type = String(formData.get("type") ?? "").trim();
  if (!DISCOUNT_TYPES.includes(type as DiscountType)) {
    fieldErrors.type = "Type must be fixed or percent.";
  }

  const scope = String(formData.get("scope") ?? "").trim();
  if (!DISCOUNT_SCOPES.includes(scope as DiscountScope)) {
    fieldErrors.scope = "Scope must be products or subscription.";
  }

  const valueRaw = String(formData.get("value") ?? "").trim();
  let storedValue: number | null = null;
  if (valueRaw === "") {
    fieldErrors.value = "Discount value is required.";
  } else if (type === "fixed") {
    const parsed = parseRupees(valueRaw, "Discount value", { minExclusive: 0 });
    if ("error" in parsed) fieldErrors.value = parsed.error;
    else storedValue = parsed.paise;
  } else if (type === "percent") {
    const parsed = parsePercent(valueRaw);
    if ("error" in parsed) fieldErrors.value = parsed.error;
    else storedValue = parsed.bp;
  }

  const minPurchaseRaw = String(formData.get("minPurchase") ?? "").trim();
  const minPurchaseResult = parseRupees(
    minPurchaseRaw === "" ? "0" : minPurchaseRaw,
    "Minimum purchase",
  );
  if ("error" in minPurchaseResult) fieldErrors.minPurchase = minPurchaseResult.error;

  const minQtyRaw = String(formData.get("minQuantity") ?? "").trim();
  const minQtyResult = parsePositiveInt(
    minQtyRaw === "" ? "1" : minQtyRaw,
    "Minimum quantity",
  );
  if ("error" in minQtyResult) fieldErrors.minQuantity = minQtyResult.error;

  const usageResult = parseOptionalPositiveInt(
    String(formData.get("usageLimit") ?? ""),
    "Usage limit",
  );
  if ("error" in usageResult) fieldErrors.usageLimit = usageResult.error;

  const perCustomerResult = parseOptionalPositiveInt(
    String(formData.get("perCustomerLimit") ?? ""),
    "Per-customer limit",
  );
  if ("error" in perCustomerResult) fieldErrors.perCustomerLimit = perCustomerResult.error;

  const startsResult = parseOptionalUtcDate(String(formData.get("startsAt") ?? ""), "Start date");
  if ("error" in startsResult) fieldErrors.startsAt = startsResult.error;

  const endsResult = parseOptionalUtcDate(String(formData.get("endsAt") ?? ""), "End date");
  if ("error" in endsResult) fieldErrors.endsAt = endsResult.error;

  if (
    !("error" in startsResult) &&
    !("error" in endsResult) &&
    startsResult.date &&
    endsResult.date &&
    endsResult.date.getTime() < startsResult.date.getTime()
  ) {
    fieldErrors.endsAt = "End date cannot be earlier than start date.";
  }

  let productIds: string[] = [];
  if (scope === "subscription") {
    productIds = [];
  } else if (scope === "products") {
    const uniqueIds = [
      ...new Set(
        formData
          .getAll("productIds")
          .map((id) => String(id).trim())
          .filter((id) => id !== ""),
      ),
    ];

    if (uniqueIds.length === 0) {
      fieldErrors.productIds = "Select at least one product for a product-scope discount.";
    } else if (uniqueIds.some((id) => !UUID_RE.test(id))) {
      fieldErrors.productIds = "One or more selected products are invalid.";
    } else {
      const found = await prisma.product.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        fieldErrors.productIds = "One or more selected products do not exist.";
      } else {
        productIds = uniqueIds;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await prisma.discount.create({
      data: {
        id: randomUUID(),
        name,
        code,
        type: type as DiscountType,
        value: storedValue as number,
        scope: scope as DiscountScope,
        productIds,
        minPurchase: (minPurchaseResult as ParseOk).paise,
        minQuantity: (minQtyResult as { value: number }).value,
        startsAt: (startsResult as { date: Date | null }).date,
        endsAt: (endsResult as { date: Date | null }).date,
        usageLimit: (usageResult as { value: number | null }).value,
        perCustomerLimit: (perCustomerResult as { value: number | null }).value,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { code: "This discount code is already in use." } };
    }
    return {
      error: err instanceof Error ? err.message : "Failed to create discount. Please try again.",
    };
  }

  revalidatePath("/admin/discounts");
  redirect("/admin/discounts");
}
