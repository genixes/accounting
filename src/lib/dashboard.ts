import "server-only";
import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";
import {
  scanAll, isLive, n, grossPayroll, netCollection,
  expenseFact, payrollFact, collectionFact, transferFact,
} from "@/lib/aggregate";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
export type RawScan = Awaited<ReturnType<typeof scanAll>>;

export type DashboardRange = { from: string; to: string };

/** Default window when the caller doesn't pick one: the last 90 days, ending today. */
export function defaultRange(): DashboardRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 89);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/** The period immediately before `range`, same length, for trend comparisons. */
function previousRange(range: DashboardRange): DashboardRange {
  const from = new Date(range.from + "T00:00:00.000Z");
  const to = new Date(range.to + "T00:00:00.000Z");
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

function bounds(range: DashboardRange) {
  return {
    fromMs: new Date(range.from + "T00:00:00.000Z").getTime(),
    toMs: new Date(range.to + "T23:59:59.999Z").getTime(),
  };
}
function within(date: Date, fromMs: number, toMs: number) {
  const t = date.getTime();
  return t >= fromMs && t <= toMs;
}
function upTo(date: Date, toMs: number) {
  return date.getTime() <= toMs;
}

/** Bank + cash total across all accounts, as of the end of `toMs` (opening
 *  balance plus every live movement dated on or before that point). */
function cashBalanceAsOf(
  accounts: { name: string; kind: string; openingBalance: unknown }[],
  liveCol: { date: Date; depositedTo: string; billAmount: unknown; ewt: unknown }[],
  liveTrf: { date: Date; toAccount: string; fromAccount: string; amount: unknown }[],
  liveExp: { date: Date; paidFrom: string; amount: unknown }[],
  livePay: { payDate: Date; paidBy: string; regularPay: unknown; otPay: unknown; caGiven: unknown; deductions: unknown; caDeduction: unknown }[],
  toMs: number
) {
  let total = 0;
  for (const a of accounts) {
    let balance = n(a.openingBalance);
    for (const c of liveCol) if (c.depositedTo === a.name && upTo(c.date, toMs)) balance += netCollection(c);
    for (const t of liveTrf) {
      if (t.toAccount === a.name && upTo(t.date, toMs)) balance += n(t.amount);
      if (t.fromAccount === a.name && upTo(t.date, toMs)) balance -= n(t.amount);
    }
    for (const e of liveExp) if (e.paidFrom === a.name && upTo(e.date, toMs)) balance -= n(e.amount);
    for (const p of livePay) if (p.paidBy === a.name && upTo(p.payDate, toMs)) {
      balance -= n(p.regularPay) + n(p.otPay) + n(p.caGiven) - n(p.deductions) - n(p.caDeduction);
    }
    total += balance;
  }
  return total;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return (curr - prev) / Math.abs(prev);
}

/** Ported from Dashboard.gs getDashboard(), extended to be period-aware so the
 *  KPI cards can show a real trend against the immediately preceding window of
 *  the same length, instead of a fabricated delta. Voided rows are excluded
 *  from every total; nothing here writes. */
export async function getDashboard(
  tenantId: string,
  session: Session,
  range?: DashboardRange,
  preScanned?: RawScan
) {
  if (!session.perms.seeAllEntries) {
    throw new Error(`Your role (${session.role}) does not have a dashboard.`);
  }
  const activeRange = range || defaultRange();
  const prevRange = previousRange(activeRange);
  const { fromMs, toMs } = bounds(activeRange);
  const { fromMs: prevFromMs, toMs: prevToMs } = bounds(prevRange);

  const [all, projects, accounts] = await Promise.all([
    preScanned ?? scanAll(tenantId),
    db.project.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  const liveExp = all.expenses.filter(isLive);
  const livePay = all.payrolls.filter(isLive);
  const liveCol = all.collections.filter(isLive);
  const liveTrf = all.transfers.filter(isLive);

  // ---- period sums (this window vs the one before it)
  const sumFlow = (fromB: number, toB: number) => {
    const collected = liveCol.filter((c) => within(c.date, fromB, toB)).reduce((s, c) => s + netCollection(c), 0);
    const cost =
      liveExp.filter((e) => within(e.date, fromB, toB)).reduce((s, e) => s + n(e.amount), 0) +
      livePay.filter((p) => within(p.payDate, fromB, toB)).reduce((s, p) => s + grossPayroll(p), 0);
    return { collected, cost, net: collected - cost };
  };
  const period = sumFlow(fromMs, toMs);
  const prevPeriod = sumFlow(prevFromMs, prevToMs);

  // ---- account balances, as of the end of the selected range (for the Cash Position card)
  const accountRows = accounts.map((a) => {
    let balance = n(a.openingBalance);
    for (const c of liveCol) if (c.depositedTo === a.name && upTo(c.date, toMs)) balance += netCollection(c);
    for (const t of liveTrf) {
      if (t.toAccount === a.name && upTo(t.date, toMs)) balance += n(t.amount);
      if (t.fromAccount === a.name && upTo(t.date, toMs)) balance -= n(t.amount);
    }
    for (const e of liveExp) if (e.paidFrom === a.name && upTo(e.date, toMs)) balance -= n(e.amount);
    for (const p of livePay) if (p.paidBy === a.name && upTo(p.payDate, toMs)) {
      balance -= n(p.regularPay) + n(p.otPay) + n(p.caGiven) - n(p.deductions) - n(p.caDeduction);
    }
    return { name: a.name, kind: a.kind, balance };
  });
  const bankTotal = accountRows.filter((a) => a.kind === "Bank").reduce((s, a) => s + a.balance, 0);
  const cashTotal = accountRows.filter((a) => a.kind === "Cash").reduce((s, a) => s + a.balance, 0);
  const cashNow = bankTotal + cashTotal;
  const cashPrev = cashBalanceAsOf(accounts, liveCol, liveTrf, liveExp, livePay, prevToMs);

  // ---- project rollups (all-time, as-of today — a contract's totals aren't a period figure)
  const projectRows = projects.map((p) => {
    const expenses =
      liveExp.filter((e) => e.projectId === p.id).reduce((s, e) => s + n(e.amount), 0) +
      livePay.filter((r) => r.projectId === p.id).reduce((s, r) => s + grossPayroll(r), 0);
    const collected = liveCol.filter((c) => c.projectId === p.id).reduce((s, c) => s + netCollection(c), 0);
    const contract = n(p.contract);
    const balance = contract - collected;
    const netPL = collected - expenses;
    const margin = contract ? netPL / contract : 0;
    return { id: p.id, no: p.no, name: p.name, client: p.client, contract, expenses, collected, balance, netPL, margin, status: p.status };
  });

  // ---- cost breakdown, scoped to the selected period
  const cats: Record<string, number> = {};
  for (const e of liveExp) {
    if (!within(e.date, fromMs, toMs)) continue;
    const k = e.category.trim() || "(uncategorised)";
    cats[k] = (cats[k] || 0) + n(e.amount);
  }
  const periodPayrollGross = livePay
    .filter((p) => within(p.payDate, fromMs, toMs))
    .reduce((s, p) => s + grossPayroll(p), 0);
  if (periodPayrollGross) cats["Labor / Payroll"] = periodPayrollGross;
  const categories = Object.entries(cats)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ---- recent activity (all-time, latest first)
  const recent = [
    ...all.expenses.map(expenseFact),
    ...all.payrolls.map(payrollFact),
    ...all.collections.map(collectionFact),
    ...all.transfers.map(transferFact),
  ].sort((a, b) => {
    const ad = a.date.getTime(), bd = b.date.getTime();
    if (ad !== bd) return bd - ad;
    return a.id < b.id ? 1 : -1;
  });

  const voided = recent.filter((x) => x.voided).length;
  const live = recent.filter((x) => !x.voided);

  const totalContract = projectRows.reduce((s, p) => s + p.contract, 0);
  const toDateCollected = liveCol.filter((c) => upTo(c.date, toMs)).reduce((s, c) => s + netCollection(c), 0);
  const receivable = totalContract - toDateCollected;

  return {
    range: activeRange,
    prevRange,
    kpi: {
      revenue: { value: period.collected, change: pctChange(period.collected, prevPeriod.collected) },
      expenses: { value: period.cost, change: pctChange(period.cost, prevPeriod.cost) },
      netIncome: { value: period.net, change: pctChange(period.net, prevPeriod.net) },
      receivable: { value: receivable, asOf: activeRange.to },
      cashBalance: { value: cashNow, change: pctChange(cashNow, cashPrev) },
    },
    accounts: accountRows,
    bankTotal,
    cashTotal,
    projects: projectRows,
    categories,
    recent: recent.slice(0, 8),
    counts: {
      entries: live.length,
      voided,
      projects: projectRows.length,
      active: projectRows.filter((p) => /on.?going|active/i.test(p.status || "")).length,
    },
  };
}

/** Monthly in/out/net totals for the last `months` calendar months, for the
 *  Cash Flow Overview chart. Independent of the KPI date range — a trend
 *  chart reads better on a fixed, longer window than the KPI cards do.
 *  Takes the same scanAll() result getDashboard() already fetched, rather
 *  than re-querying the same four tables a second time. */
export function getCashFlowSeries(all: RawScan, months = 6) {
  const facts = [
    ...all.expenses.map(expenseFact),
    ...all.payrolls.map(payrollFact),
    ...all.collections.map(collectionFact),
    ...all.transfers.map(transferFact),
  ].filter((f) => !f.voided);

  const now = new Date();
  const buckets: { key: string; label: string; in: number; out: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: d.toLocaleDateString("en-PH", { month: "short", timeZone: "UTC" }), in: 0, out: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const f of facts) {
    const key = `${f.date.getUTCFullYear()}-${String(f.date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = byKey.get(key);
    if (!bucket) continue;
    if (f.dir === "in") bucket.in += f.amount;
    if (f.dir === "out") bucket.out += f.amount;
  }

  return buckets.map((b) => ({ month: b.label, in: b.in, out: b.out, net: b.in - b.out }));
}
