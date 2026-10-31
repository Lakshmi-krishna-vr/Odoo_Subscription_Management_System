import { describe, expect, it } from "vitest";
import type { PlanPolicy } from "@/contracts";
import {
  checkTransition,
  deriveInvoiceStatus,
  invoiceBalance,
  nextSubStatus,
} from "@/core/state";

const openPlan: PlanPolicy = {
  pausable: true,
  renewable: true,
  closable: true,
  autoClose: false,
};

describe("subscription status", () => {
  it("moves draft to quotation to confirmed to active", () => {
    expect(nextSubStatus("draft", "send_quote")).toBe("quotation");
    expect(nextSubStatus("quotation", "confirm")).toBe("confirmed");
    expect(nextSubStatus("confirmed", "activate")).toBe("active");
  });

  it("rejects a move that is not in the table", () => {
    expect(nextSubStatus("active", "confirm")).toBeNull();
    expect(nextSubStatus("closed", "activate")).toBeNull();
  });

  it("honours the plan switches", () => {
    const noPause: PlanPolicy = { ...openPlan, pausable: false };
    expect(checkTransition({ from: "active", event: "pause", plan: noPause }).ok).toBe(false);
    expect(checkTransition({ from: "active", event: "pause", plan: openPlan }).ok).toBe(true);
  });

  it("explains why a move was refused", () => {
    const locked: PlanPolicy = { ...openPlan, closable: false, autoClose: false };
    const result = checkTransition({ from: "active", event: "close", plan: locked });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("closed early");
  });
});

describe("invoice status", () => {
  const base = { total: 100_000, dueDate: "2026-10-31", today: "2026-11-05" };

  it("is draft until it is confirmed", () => {
    expect(deriveInvoiceStatus({ ...base, amountPaid: 0 })).toBe("draft");
  });

  it("is overdue when confirmed, unpaid and past the due date", () => {
    expect(deriveInvoiceStatus({ ...base, amountPaid: 0, confirmed: true })).toBe("overdue");
  });

  it("is confirmed when still inside the payment terms", () => {
    expect(
      deriveInvoiceStatus({ ...base, amountPaid: 0, confirmed: true, today: "2026-10-30" }),
    ).toBe("confirmed");
  });

  it("is partially paid between zero and the total", () => {
    expect(deriveInvoiceStatus({ ...base, amountPaid: 40_000, confirmed: true })).toBe(
      "partially_paid",
    );
  });

  it("is paid once the total is covered", () => {
    expect(deriveInvoiceStatus({ ...base, amountPaid: 100_000, confirmed: true })).toBe("paid");
  });

  it("never shows a negative balance", () => {
    expect(invoiceBalance(100_000, 120_000)).toBe(0);
    expect(invoiceBalance(100_000, 40_000)).toBe(60_000);
  });
});
