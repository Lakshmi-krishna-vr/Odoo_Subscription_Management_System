import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  advance,
  daysBetween,
  isDue,
  periodEnd,
} from "@/core/periods";

describe("billing periods", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("advances a daily plan", () => {
    expect(advance("2026-03-01", "day")).toBe("2026-03-02");
  });

  it("advances a weekly plan by seven days", () => {
    expect(advance("2026-03-10", "week")).toBe("2026-03-17");
  });

  it("clamps to the end of a short month", () => {
    expect(advance("2026-01-31", "month", 1, 31)).toBe("2026-02-28");
  });

  it("restores the anchor day after a short month", () => {
    expect(advance("2026-02-28", "month", 1, 31)).toBe("2026-03-31");
  });

  it("handles a leap-day yearly plan", () => {
    expect(advance("2024-02-29", "year")).toBe("2025-02-28");
  });

  it("keeps the day of month for a normal monthly plan", () => {
    expect(addMonths("2026-06-15", 1)).toBe("2026-07-15");
  });

  it("counts the days between two dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("treats a period end as exclusive", () => {
    const start = "2026-10-01";
    const end = periodEnd(start, "month");
    expect(end).toBe("2026-11-01");
    expect(daysBetween(start, end)).toBe(31);
  });

  it("is due on the billing date and when a run was missed", () => {
    expect(isDue("2026-10-31", "2026-10-31")).toBe(true);
    expect(isDue("2026-10-01", "2026-10-31")).toBe(true);
    expect(isDue("2026-11-01", "2026-10-31")).toBe(false);
  });
});
