"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_PAISE, PLAN_PERIODS, type PlanPeriod } from "@/contracts";
import { rupeesToPaise } from "@/core/money";
import { requireRole } from "@/server/auth";
import { prisma } from "@/server/db";

export interface PlanState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

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

export async function createPlanAction(
  _prev: PlanState,
  formData: FormData,
): Promise<PlanState> {
  await requireRole(["admin"]);

  const fieldErrors: Record<string, string> = {};

  const name = String(formData.get("name") ?? "").trim();
  if (!name) fieldErrors.name = "Plan name is required.";

  const billingPeriod = String(formData.get("billingPeriod") ?? "").trim();
  if (!PLAN_PERIODS.includes(billingPeriod as PlanPeriod)) {
    fieldErrors.billingPeriod = "Billing period must be day, week, month or year.";
  }

  const priceRaw = String(formData.get("price") ?? "").trim();
  if (priceRaw === "") {
    fieldErrors.price = "Price is required.";
  }
  const priceResult = priceRaw !== "" ? parseRupees(priceRaw, "Price") : null;
  if (priceResult && "error" in priceResult) fieldErrors.price = priceResult.error;

  const intervalRaw = String(formData.get("intervalCount") ?? "").trim();
  const intervalResult = parsePositiveInt(intervalRaw === "" ? "1" : intervalRaw, "Interval count");
  if ("error" in intervalResult) fieldErrors.intervalCount = intervalResult.error;

  const minQtyRaw = String(formData.get("minQuantity") ?? "").trim();
  const minQtyResult = parsePositiveInt(minQtyRaw === "" ? "1" : minQtyRaw, "Minimum quantity");
  if ("error" in minQtyResult) fieldErrors.minQuantity = minQtyResult.error;

  const fromResult = parseOptionalUtcDate(
    String(formData.get("availableFrom") ?? ""),
    "Available from",
  );
  if ("error" in fromResult) fieldErrors.availableFrom = fromResult.error;

  const toResult = parseOptionalUtcDate(String(formData.get("availableTo") ?? ""), "Available to");
  if ("error" in toResult) fieldErrors.availableTo = toResult.error;

  if (
    !("error" in fromResult) &&
    !("error" in toResult) &&
    fromResult.date &&
    toResult.date &&
    toResult.date.getTime() < fromResult.date.getTime()
  ) {
    fieldErrors.availableTo = "Available to cannot be earlier than available from.";
  }

  // Unchecked boxes are absent from FormData — persist them as false.
  const autoClose = formData.get("autoClose") === "on";
  const closable = formData.get("closable") === "on";
  const pausable = formData.get("pausable") === "on";
  const renewable = formData.get("renewable") === "on";

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const pricePaise = (priceResult as ParseOk).paise;
  const intervalCount = (intervalResult as { value: number }).value;
  const minQuantity = (minQtyResult as { value: number }).value;
  const availableFrom = (fromResult as { date: Date | null }).date;
  const availableTo = (toResult as { date: Date | null }).date;

  try {
    await prisma.plan.create({
      data: {
        id: randomUUID(),
        name,
        price: pricePaise,
        billingPeriod: billingPeriod as PlanPeriod,
        intervalCount,
        minQuantity,
        availableFrom,
        availableTo,
        autoClose,
        closable,
        pausable,
        renewable,
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create plan. Please try again.",
    };
  }

  revalidatePath("/admin/plans");
  redirect("/admin/plans");
}
