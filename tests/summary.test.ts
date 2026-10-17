import { describe, expect, it } from "vitest";
import { monthOrCurrent, shiftMonth, summariseMonth } from "@/lib/summary";
import { classifyDeadline } from "@/lib/firm/deadlines";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("summariseMonth", () => {
  const input = {
    collections: [
      { date: d("2026-10-02"), billAmount: 1000, ewt: 10, voidedAt: null },
      { date: d("2026-10-31"), billAmount: 500.55, ewt: 0, voidedAt: null },
      { date: d("2026-10-05"), billAmount: 9999, ewt: 0, voidedAt: new Date() }, // voided
      { date: d("2026-09-30"), billAmount: 7777, ewt: 0, voidedAt: null }, // other month
      { date: d("2026-11-01"), billAmount: 8888, ewt: 0, voidedAt: null }, // other month
    ],
    expenses: [
      { date: d("2026-10-03"), amount: 200.1, category: "Shipping", voidedAt: null },
      { date: d("2026-10-04"), amount: 100.2, category: "Shipping", voidedAt: null },
      { date: d("2026-10-10"), amount: 50, category: "Ads", voidedAt: null },
      { date: d("2026-10-11"), amount: 5000, category: "Ads", voidedAt: new Date() }, // voided
    ],
  };

  it("sums only live rows in the month and rounds to centavos", () => {
    const s = summariseMonth(input, "2026-10");
    expect(s.sales).toBe(1500.55);
    expect(s.withheld).toBe(10);
    expect(s.received).toBe(1490.55);
    expect(s.costs).toBe(350.3);
    expect(s.leftAfterCosts).toBe(1140.25);
    expect(s.costsByCategory).toEqual([{ category: "Shipping", amount: 300.3 }, { category: "Ads", amount: 50 }]);
    expect(s.entryCount).toBe(5);
  });

  it("includes first and last day of the month, excludes neighbours", () => {
    expect(summariseMonth(input, "2026-09").sales).toBe(7777);
    expect(summariseMonth(input, "2026-11").sales).toBe(8888);
  });

  it("handles an empty month and negative results", () => {
    expect(summariseMonth(input, "2026-01")).toMatchObject({ sales: 0, costs: 0, leftAfterCosts: 0, entryCount: 0 });
    expect(summariseMonth({ collections: [], expenses: [{ date: d("2026-10-01"), amount: 5, category: "X", voidedAt: null }] }, "2026-10").leftAfterCosts).toBe(-5);
  });

  it("is not thrown off by floating point", () => {
    const s = summariseMonth({ collections: [0.1, 0.2].map((a) => ({ date: d("2026-10-01"), billAmount: a, ewt: 0, voidedAt: null })), expenses: [] }, "2026-10");
    expect(s.sales).toBe(0.3);
  });

  it("rejects malformed months", () => {
    expect(() => summariseMonth(input, "2026-13")).toThrow();
    expect(() => summariseMonth(input, "oct")).toThrow();
  });

  it("navigates months across year boundaries and falls back safely", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthOrCurrent("garbage", new Date("2026-10-17T00:00:00Z"))).toBe("2026-10");
    expect(monthOrCurrent("2026-02", new Date())).toBe("2026-02");
  });
});

describe("classifyDeadline", () => {
  const now = new Date("2026-10-17T15:00:00Z");
  it("classifies by whole days", () => {
    expect(classifyDeadline({ dueDate: d("2026-10-17"), status: "OPEN" }, now)).toMatchObject({ key: "soon", label: "Due today" });
    expect(classifyDeadline({ dueDate: d("2026-10-18"), status: "OPEN" }, now).label).toBe("Due in 1 day");
    expect(classifyDeadline({ dueDate: d("2026-10-31"), status: "OPEN" }, now).key).toBe("soon");
    expect(classifyDeadline({ dueDate: d("2026-11-01"), status: "OPEN" }, now).key).toBe("upcoming");
    expect(classifyDeadline({ dueDate: d("2026-10-16"), status: "OPEN" }, now)).toMatchObject({ key: "overdue", label: "Overdue by 1 day", tone: "bad" });
    expect(classifyDeadline({ dueDate: d("2026-10-10"), status: "OPEN" }, now).label).toBe("Overdue by 7 days");
  });
  it("done always wins, even if past due", () => {
    expect(classifyDeadline({ dueDate: d("2020-01-01"), status: "DONE" }, now).key).toBe("done");
  });
});
