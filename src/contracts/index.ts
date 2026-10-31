/**
 * Shared types for the whole application.
 *
 * Rules that everything else depends on:
 *  - money is always an integer number of paise (never rupees, never a float)
 *  - percentages are stored as basis points (18% = 1800)
 *  - dates are ISO strings "YYYY-MM-DD" so they compare lexicographically
 */

export type Paise = number;
export type BasisPoints = number;

/** Int32 ceiling: ₹2,14,74,836.47 per field. */
export const MAX_PAISE: Paise = 2_147_483_647;

export type RoleKey = "admin" | "staff" | "customer";
export const ROLES: readonly RoleKey[] = ["admin", "staff", "customer"];

export type PlanPeriod = "day" | "week" | "month" | "year";
export const PLAN_PERIODS: readonly PlanPeriod[] = ["day", "week", "month", "year"];

/** A billing period. `end` is exclusive. */
export interface Period {
  start: string;
  end: string;
}

// ---------------------------------------------------------------- catalogue

export interface TaxRule {
  id: string;
  name: string;
  rateBp: BasisPoints;
}

export interface VariantRef {
  id: string;
  attribute: string;
  value: string;
  /** added to the product's sales price, e.g. the Odoo brand +₹560 */
  extraPrice: Paise;
}

export interface ProductRef {
  id: string;
  name: string;
  salesPrice: Paise;
  taxId: string | null;
}

export type DiscountType = "fixed" | "percent";
export type DiscountScope = "products" | "subscription";

export interface DiscountRule {
  id: string;
  name: string;
  /** fixed → `value` is paise; percent → `value` is basis points */
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  /** which products the rule covers when scope is "products" */
  productIds: readonly string[];
  minPurchase: Paise;
  minQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

// ------------------------------------------------------------------ pricing

export interface PriceLineInput {
  product: ProductRef;
  variant?: VariantRef | null;
  quantity: number;
  /** a negotiated price that overrides the catalogue price */
  unitPriceOverride?: Paise | null;
}

export interface PriceInput {
  lines: readonly PriceLineInput[];
  taxes: readonly TaxRule[];
  discounts: readonly DiscountRule[];
  /** how many times each discount has already been used by this customer */
  customerRedemptions?: Readonly<Record<string, number>>;
  /** eligibility is evaluated as of this date */
  asOf: string;
}

export interface PricedLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: Paise;
  gross: Paise;
  discountAmount: Paise;
  appliedDiscountIds: readonly string[];
  taxableAmount: Paise;
  taxRateBp: BasisPoints;
  taxAmount: Paise;
  lineTotal: Paise;
}

export interface PricedDoc {
  lines: readonly PricedLine[];
  subtotal: Paise;
  discountTotal: Paise;
  taxTotal: Paise;
  total: Paise;
  appliedDiscounts: readonly { discountId: string; amount: Paise }[];
  warnings: readonly string[];
}

// ------------------------------------------------------------- subscriptions

export type SubStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "closed";

export type SubEvent =
  | "send_quote"
  | "confirm"
  | "activate"
  | "pause"
  | "resume"
  | "renew"
  | "close";

/** The four switches the admin sets per plan. */
export interface PlanPolicy {
  pausable: boolean;
  renewable: boolean;
  closable: boolean;
  autoClose: boolean;
}

// ----------------------------------------------------------------- invoices

export type InvoiceStatus =
  | "draft"
  | "confirmed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type PaymentMethod = "online" | "upi" | "bank" | "cash" | "cheque";

// ---------------------------------------------------------------- billing

export interface BillingRunSummary {
  runId: string;
  asOf: string;
  dryRun: boolean;
  considered: number;
  created: number;
  skipped: number;
  errors: readonly { subscriptionId: string; message: string }[];
}

// ---------------------------------------------------------------- reporting

export interface DashboardKpis {
  activeSubscriptions: number;
  invoicedInPeriod: Paise;
  collectedInPeriod: Paise;
  outstanding: Paise;
  overdueCount: number;
}

// ---------------------------------------------------------------- transport

export interface Page<T> {
  data: readonly T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}
