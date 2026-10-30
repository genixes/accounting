import { test } from "node:test";
import assert from "node:assert/strict";
import { round, formatMoney, roundMoney } from "./money";
import { findRate, convert } from "./fx";
import { npv, irr, xirr, equityMultiple } from "./returns";
import { capRate, cashOnCash, dscr, grm, netSaleProceeds, maxOfferForCapRate } from "./metrics";
import { paymentFor, schedule, balanceAfter, paymentsElapsed, yearlySummary } from "./amortization";
import { validateLines, incomeStatement, cashFlow } from "./ledger";
import { analyzeDeal, validateDeal, type DealInput } from "./deal";
import { buildAlerts, daysUntil, severityFor } from "./alerts";
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

const deal: DealInput = {
  price: 1_000_000, closingCostPct: 0, downPaymentPct: 0.2, interestRate: 0, loanYears: 10, monthlyRent: 10_000,
  vacancyPct: 0, opexPct: 0, annualRentGrowth: 0, annualAppreciation: 0, holdYears: 5, sellingCostPct: 0, targetCapRate: 0.1,
};

test("deal analyzer: hand-computed 0% loan case", () => {
  const r = analyzeDeal(deal);
  assert.equal(r.loanAmount, 800_000);
  assert.equal(r.cashInvested, 200_000);
  assert.equal(r.noi, 120_000);
  assert.equal(r.annualDebtService, 80_000);
  assert.equal(r.annualCashFlow, 40_000);
  close(r.capRate, 0.12);
  close(r.cashOnCash, 0.2);
  close(r.dscr, 1.5);
  close(r.grm, 1_000_000 / 120_000);
  close(r.maxOffer!, 1_200_000);
  // 5 years of 40k, then sale at 1,000,000 less the loan balance (800k - 5*80k = 400k) = 600k
  // Payments are rounded to cents (6,666.67 x 60), so allow a few cents of drift.
  [-200_000, 40_000, 40_000, 40_000, 40_000, 640_000].forEach((v, i) => close(r.flows[i], v, 1));
  close(r.years[4].loanBalance, 400_000, 1);
  close(r.equityMultiple, 800_000 / 200_000, 1e-4);
  assert.ok(r.irr! > 0.3);
});

test("deal analyzer: growth, vacancy, costs and payoff inside hold", () => {
  const r = analyzeDeal({ ...deal, vacancyPct: 0.1, opexPct: 0.3, annualRentGrowth: 0.03, annualAppreciation: 0.04, sellingCostPct: 0.05, loanYears: 3, holdYears: 5 });
  assert.equal(r.years[3].debtService, 0); // loan paid off after year 3
  assert.equal(r.years[3].loanBalance, 0);
  close(r.years[1].noi, 120_000 * 1.03 * 0.9 * 0.7, 1);
  close(r.years[4].saleProceeds, 1_000_000 * 1.04 ** 5 * 0.95, 1);
});

test("deal analyzer: all-cash has no DSCR and validation rejects bad input", () => {
  const r = analyzeDeal({ ...deal, downPaymentPct: 1 });
  assert.equal(r.loanAmount, 0);
  assert.equal(r.dscr, null);
  assert.equal(validateDeal(deal), null);
  assert.match(validateDeal({ ...deal, price: 0 })!, /price/);
  assert.match(validateDeal({ ...deal, downPaymentPct: 1.5 })!, /Down payment/);
  assert.match(validateDeal({ ...deal, holdYears: 2.5 })!, /Hold/);
});

test("loan status helpers", () => {
  const start = new Date("2026-01-15T00:00:00Z");
  assert.equal(paymentsElapsed(start, new Date("2026-01-14T00:00:00Z"), 30), 0);
  assert.equal(paymentsElapsed(start, new Date("2026-02-15T00:00:00Z"), 30), 1);
  assert.equal(paymentsElapsed(start, new Date("2026-02-14T00:00:00Z"), 30), 0);
  assert.equal(paymentsElapsed(start, new Date("2100-01-01T00:00:00Z"), 30), 360);
  assert.equal(paymentsElapsed(start, new Date("2025-01-01T00:00:00Z"), 30), 0);
  const ys = yearlySummary({ principal: 100_000, annualRate: 0.05, years: 5 });
  assert.equal(ys.length, 5);
  assert.equal(ys[4].balance, 0);
  close(ys.reduce((s, r) => s + r.principal, 0), 100_000, 0.01);
  assert.ok(ys[0].interest > ys[4].interest);
});

test("alerts: windowing, severity and ordering", () => {
  const today = new Date("2026-10-30T15:00:00Z");
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  assert.equal(daysUntil(d("2026-10-30"), today), 0);
  assert.equal(daysUntil(d("2026-10-29"), today), -1);
  assert.equal(severityFor(-1), "overdue");
  assert.equal(severityFor(30), "soon");
  assert.equal(severityFor(31), "upcoming");
  const a = buildAlerts({
    today,
    leases: [
      { propertyId: "p1", propertyName: "A", unit: "1", tenantName: "T1", endDate: d("2026-11-20") },
      { propertyId: "p1", propertyName: "A", unit: "2", tenantName: "T2", endDate: d("2026-10-01") },
      { propertyId: "p1", propertyName: "A", unit: "3", tenantName: "T3", endDate: d("2027-06-01") }, // beyond horizon
      { propertyId: "p1", propertyName: "A", unit: "4", tenantName: "T4", endDate: null },
    ],
    documents: [{ propertyId: "p2", propertyName: "B", name: "Fire policy", category: "INSURANCE", expiresOn: d("2026-12-15") }],
    loans: [{ propertyId: "p2", propertyName: "B", lender: "Bank", startDate: d("1996-11-15"), termYears: 30 }],
    vacancies: [{ propertyId: "p2", propertyName: "B", unit: "9" }],
  });
  assert.deepEqual(a.map((x) => `${x.severity}:${x.kind}`), [
    "overdue:LEASE_ENDING", "soon:LOAN_MATURING", "soon:LEASE_ENDING", "upcoming:DOCUMENT_EXPIRING", "upcoming:VACANT_UNIT",
  ]);
  assert.match(a[0].detail, /29 days overdue/);
  assert.match(a[1].detail, /in 16 days/); // loan first: sorted by days within a severity
  assert.match(a[2].detail, /in 21 days/);
});
