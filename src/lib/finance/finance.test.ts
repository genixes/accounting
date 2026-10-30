import { test } from "node:test";
import assert from "node:assert/strict";
import { round, formatMoney, roundMoney } from "./money";
import { findRate, convert } from "./fx";
import { npv, irr, xirr, equityMultiple } from "./returns";
import { capRate, cashOnCash, dscr, grm, netSaleProceeds, maxOfferForCapRate } from "./metrics";
import { paymentFor, schedule, balanceAfter } from "./amortization";
import { validateLines, incomeStatement, cashFlow } from "./ledger";
import { canTransition, allowedTransitions } from "./lifecycle";

const close = (a: number | null, b: number, eps = 1e-6) => {
  assert.ok(a !== null && Math.abs(a - b) < eps, `${a} !~ ${b}`);
};

test("round avoids float traps and is symmetric", () => {
  assert.equal(round(1.005), 1.01);
  assert.equal(round(-1.005), -1.01);
  assert.equal(roundMoney(1234.5, "JPY"), 1235);
});

test("formatMoney respects currency decimals", () => {
  assert.equal(formatMoney(1234.5, "USD"), "$1,234.50");
  assert.equal(formatMoney(-1234.5, "PHP"), "-₱1,234.50");
  assert.equal(formatMoney(1234.5, "JPY"), "¥1,235");
});

test("fx: direct, inverse, pivot, and unresolved", () => {
  const d = (s: string) => new Date(s);
  const q = [
    { from: "USD", to: "PHP", rate: 56, asOf: d("2026-01-01") },
    { from: "USD", to: "PHP", rate: 58, asOf: d("2026-06-01") },
    { from: "EUR", to: "USD", rate: 1.1, asOf: d("2026-01-01") },
  ];
  assert.equal(findRate(q, "USD", "PHP", d("2026-03-01")), 56);
  assert.equal(findRate(q, "USD", "PHP", d("2026-07-01")), 58);
  close(findRate(q, "PHP", "USD", d("2026-07-01")), 1 / 58);
  close(findRate(q, "EUR", "PHP", d("2026-07-01")), 1.1 * 58);
  assert.equal(findRate(q, "USD", "PHP", d("2025-01-01")), null);
  assert.equal(findRate(q, "PHP", "PHP", d("2026-01-01")), 1);
  assert.equal(findRate(q, "GBP", "PHP", d("2026-07-01")), null);
  assert.equal(convert(100, 56.789), 5678.9);
});

test("npv / irr / xirr / equity multiple", () => {
  close(npv(0.1, [-100, 110]), 0);
  close(irr([-100, 110]), 0.1);
  close(irr([-1000, 300, 400, 500]), 0.0889632, 1e-5);
  assert.equal(irr([100, 200]), null);
  const x = xirr([
    { date: new Date("2026-01-01"), amount: -1000 },
    { date: new Date("2027-01-01"), amount: 1100 },
  ]);
  close(x, 0.1, 1e-4);
  close(equityMultiple([-1000, 300, 1200]), 1.5);
  assert.equal(equityMultiple([100]), null);
});

test("property metrics", () => {
  close(capRate(80_000, 1_000_000), 0.08);
  assert.equal(capRate(1, 0), null);
  close(cashOnCash(12_000, 200_000), 0.06);
  close(dscr(80_000, 60_000), 80 / 60);
  close(grm(1_000_000, 100_000), 10);
  close(maxOfferForCapRate(80_000, 0.08)!, 1_000_000);
  close(netSaleProceeds(1_000_000, 0.05, 400_000), 550_000);
});

test("amortization: known payment, zero balance at end, 0% rate", () => {
  const t = { principal: 200_000, annualRate: 0.06, years: 30 };
  close(paymentFor(t), 1199.1010, 1e-3);
  const rows = schedule(t);
  assert.equal(rows.length, 360);
  assert.equal(rows[359].balance, 0);
  close(rows.reduce((s, r) => s + r.principal, 0), 200_000, 0.01);
  assert.equal(balanceAfter(t, 0), 200_000);
  assert.equal(balanceAfter(t, 360), 0);
  close(paymentFor({ principal: 1200, annualRate: 0, years: 1 }), 100);
});

test("ledger: validation, P&L and cash flow", () => {
  assert.equal(validateLines([{ accountId: "cash", debit: 100, credit: 0 }, { accountId: "rent", debit: 0, credit: 100 }]), null);
  assert.match(validateLines([{ accountId: "a", debit: 100, credit: 0 }, { accountId: "b", debit: 0, credit: 90 }])!, /out of balance/);
  assert.match(validateLines([{ accountId: "a", debit: 100, credit: 100 }, { accountId: "b", debit: 0, credit: 0 }])!, /either/);
  assert.ok(validateLines([{ accountId: "a", debit: 5, credit: 0 }]));

  const lines = [
    { accountId: "cash", code: "1000", name: "Cash", type: "ASSET" as const, debit: 1000, credit: 0 },
    { accountId: "rent", code: "4000", name: "Rental income", type: "INCOME" as const, debit: 0, credit: 1000 },
    { accountId: "rep", code: "5000", name: "Repairs", type: "EXPENSE" as const, debit: 250, credit: 0 },
    { accountId: "cash", code: "1000", name: "Cash", type: "ASSET" as const, debit: 0, credit: 250 },
  ];
  const pl = incomeStatement(lines);
  assert.equal(pl.totalIncome, 1000);
  assert.equal(pl.totalExpenses, 250);
  assert.equal(pl.netIncome, 750);
  assert.deepEqual(cashFlow(lines, new Set(["cash"])), { inflows: 1000, outflows: 250, net: 750 });
});

test("lifecycle transitions", () => {
  assert.ok(canTransition("PROSPECT", "UNDER_CONTRACT"));
  assert.ok(!canTransition("PROSPECT", "SOLD"));
  assert.ok(!canTransition("LEASED", "PROSPECT"));
  assert.deepEqual(allowedTransitions("SOLD"), []);
});
