import { n } from "@/lib/aggregate";

export type SummaryInput = {
  collections: { date: Date; billAmount: unknown; ewt: unknown; voidedAt: Date | null }[];
  expenses: { date: Date; amount: unknown; category: string; voidedAt: Date | null }[];
};

export type MonthlySummary = {
  month: string; // YYYY-MM
  sales: number;
  withheld: number;
  received: number;
  costs: number;
  costsByCategory: { category: string; amount: number }[];
  leftAfterCosts: number;
  entryCount: number;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Month is read in UTC to match how entry dates are stored (midnight UTC). Voided rows never count. */
export function summariseMonth(input: SummaryInput, month: string): MonthlySummary {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("month must be YYYY-MM");
  const inMonth = (d: Date) => d.toISOString().slice(0, 7) === month;

  const cols = input.collections.filter((c) => !c.voidedAt && inMonth(c.date));
  const exps = input.expenses.filter((e) => !e.voidedAt && inMonth(e.date));

  const sales = cols.reduce((t, c) => t + n(c.billAmount), 0);
  const withheld = cols.reduce((t, c) => t + n(c.ewt), 0);
  const costs = exps.reduce((t, e) => t + n(e.amount), 0);

  const byCat = new Map<string, number>();
  for (const e of exps) byCat.set(e.category, (byCat.get(e.category) ?? 0) + n(e.amount));

  return {
    month,
    sales: r2(sales),
    withheld: r2(withheld),
    received: r2(sales - withheld),
    costs: r2(costs),
    costsByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount: r2(amount) })).sort((a, b) => b.amount - a.amount),
    leftAfterCosts: r2(sales - withheld - costs),
    entryCount: cols.length + exps.length,
  };
}

export function monthOrCurrent(raw: string | undefined, now = new Date()): string {
  return raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : now.toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
}
