import "server-only";
import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";
import {
  scanAll, isLive, n, grossPayroll, netCollection,
  expenseFact, payrollFact, collectionFact, transferFact,
} from "@/lib/aggregate";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Ported from Dashboard.gs getDashboard(). Voided rows are excluded from
 *  every total; nothing here writes. */
export async function getDashboard(tenantId: string, session: Session) {
  if (!session.perms.seeAllEntries) {
    throw new Error(`Your role (${session.role}) does not have a dashboard.`);
  }

  const [all, projects, accounts] = await Promise.all([
    scanAll(tenantId),
    db.project.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
  ]);

  const liveExp = all.expenses.filter(isLive);
  const livePay = all.payrolls.filter(isLive);
  const liveCol = all.collections.filter(isLive);
  const liveTrf = all.transfers.filter(isLive);

  // ---- account balances: opening balance + every live movement that touches it
  const accountRows = accounts.map((a) => {
    let balance = n(a.openingBalance);
    for (const c of liveCol) if (c.depositedTo === a.name) balance += netCollection(c);
    for (const t of liveTrf) {
      if (t.toAccount === a.name) balance += n(t.amount);
      if (t.fromAccount === a.name) balance -= n(t.amount);
    }
    for (const e of liveExp) if (e.paidFrom === a.name) balance -= n(e.amount);
    for (const p of livePay) if (p.paidBy === a.name) balance -= n(p.regularPay) + n(p.otPay) + n(p.caGiven) - n(p.deductions) - n(p.caDeduction);
    return { name: a.name, kind: a.kind, balance };
  });
  const bankTotal = accountRows.filter((a) => a.kind === "Bank").reduce((s, a) => s + a.balance, 0);
  const cashTotal = accountRows.filter((a) => a.kind === "Cash").reduce((s, a) => s + a.balance, 0);

  // ---- project rollups
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

  // ---- cost breakdown
  const cats: Record<string, number> = {};
  for (const e of liveExp) {
    const k = e.category.trim() || "(uncategorised)";
    cats[k] = (cats[k] || 0) + n(e.amount);
  }
  const payrollGross = livePay.reduce((s, p) => s + grossPayroll(p), 0);
  if (payrollGross) cats["Labor / Payroll"] = payrollGross;
  const categories = Object.entries(cats)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // ---- recent activity
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
  const totalCollected = projectRows.reduce((s, p) => s + p.collected, 0);
  const totalExpenses = projectRows.reduce((s, p) => s + p.expenses, 0);
  const receivable = projectRows.reduce((s, p) => s + p.balance, 0);

  return {
    company: "",
    kpi: {
      contract: totalContract,
      collected: totalCollected,
      receivable,
      expenses: totalExpenses,
      netPL: totalCollected - totalExpenses,
      margin: totalContract ? (totalCollected - totalExpenses) / totalContract : 0,
    },
    accounts: accountRows,
    bankTotal,
    cashTotal,
    projects: projectRows,
    categories,
    recent: recent.slice(0, 14),
    counts: {
      entries: live.length,
      voided,
      projects: projectRows.length,
      active: projectRows.filter((p) => /on.?going|active/i.test(p.status || "")).length,
    },
  };
}
