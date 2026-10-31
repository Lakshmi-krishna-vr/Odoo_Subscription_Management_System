import { describe, expect, it } from "vitest";
import {
  allocateProRata,
  formatINR,
  paiseToRupees,
  roundHalfUp,
  rupeesToPaise,
} from "@/core/money";

describe("money", () => {
  it("converts rupees to paise without floating point drift", () => {
    expect(rupeesToPaise(999.99)).toBe(99999);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it("converts paise back to rupees", () => {
    expect(paiseToRupees(184080)).toBe(1840.8);
  });

  it("formats with Indian digit grouping", () => {
    expect(formatINR(184080)).toBe("₹1,840.80");
    expect(formatINR(12345678)).toBe("₹1,23,456.78");
    expect(formatINR(5)).toBe("₹0.05");
  });

  it("rounds half up, not to even", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4)).toBe(2);
    expect(roundHalfUp(28080)).toBe(28080);
  });

  it("splits an amount without losing a paise", () => {
    const parts = allocateProRata(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it("splits proportionally to the weights", () => {
    expect(allocateProRata(1000, [3, 1])).toEqual([750, 250]);
  });

  it("returns zeros when there is nothing to split", () => {
    expect(allocateProRata(500, [0, 0])).toEqual([0, 0]);
  });
});
