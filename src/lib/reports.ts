import "server-only";
import { db } from "@/lib/db";
import { n, grossPayroll, netCollection } from "@/lib/aggregate";
import type { Session } from "@/lib/auth";

function requireCanReport(session: Session) {
  if (!session.perms.canReport) {
    throw new Error(`Your role (${session.role}) cannot generate reports.`);
  }
}

function dateRange(from?: string, to?: string) {
  const where: { gte?: Date; lte?: Date } = {};
  if (from) where.gte = new Date(from + "T00:00:00.000Z");
  if (to) where.lte = new Date(to + "T23:59:59.999Z");
  return Object.keys(where).length ? where : undefined;
}

export function rangeLabel(from?: string, to?: string) {
  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00").toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" });
  if (!from && !to) return "All time";
  if (from && !to) return `From ${fmt(from)}`;
  if (!from && to) return `Up to ${fmt(to)}`;
  return `${fmt(from as string)} to ${fmt(to as string)}`;
}

async function liveRows(tenantId: string, projectId: string | undefined, from?: string, to?: string) {
  const range = dateRange(from, to);
  const projectFilter = projectId ? { projectId } : {};
  const [exp, pay, col] = await Promise.all([
    db.expense.findMany({
      where: { tenantId, voidedAt: null, ...projectFilter, ...(range ? { date: range } : {}) },
      include: { project: { select: { name: true } } },
    }),
    db.payroll.findMany({
      where: { tenantId, voidedAt: null, ...projectFilter, ...(range ? { payDate: range } : {}) },
      include: { project: { select: { name: true } } },
    }),
    db.collection.findMany({
      where: { tenantId, voidedAt: null, ...projectFilter, ...(range ? { date: range } : {}) },
      include: { project: { select: { name: true } } },
    }),
  ]);
  return { exp, pay, col };
}

/**
 * The period-vs-to-date split from Reports.gs periodFacts_(): transactions
 * are filtered to the window, but contract value and receivable are stated
 * AS OF the end date — counting everything since the start of the project,
 * because a two-week slice would report a receivable that ignores every
 * earlier payment.
 */
export async function periodFacts(tenantId: string, projectId: string, from?: string, to?: string) {
  const period = await liveRows(tenantId, projectId, from, to);
  const toDate = await liveRows(tenantId, projectId, undefined, to);

  const periodExpenses = period.exp.reduce((s, r) => s + n(r.amount), 0) + period.pay.reduce((s, r) => s + grossPayroll(r), 0);
  const periodBilled = period.col.reduce((s, r) => s + n(r.billAmount), 0);
  const periodEwt = period.col.reduce((s, r) => s + n(r.ewt), 0);
  const periodCollected = period.col.reduce((s, r) => s + netCollection(r), 0);

  const toDateExpenses = toDate.exp.reduce((s, r) => s + n(r.amount), 0) + toDate.pay.reduce((s, r) => s + grossPayroll(r), 0);
  const toDateCollected = toDate.col.reduce((s, r) => s + netCollection(r), 0);
  const toDateBilled = toDate.col.reduce((s, r) => s + n(r.billAmount), 0);

  return {
    exp: period.exp, pay: period.pay, col: period.col,
    periodExpenses, periodBilled, periodEwt, periodCollected, periodNet: periodCollected - periodExpenses,
    toDateExpenses, toDateCollected, toDateBilled,
  };
}

export async function projectByName(tenantId: string, name: string) {
  return db.project.findUnique({ where: { tenantId_name: { tenantId, name } } });
}

export async function renderProjectDetail(tenantId: string, session: Session, projectName: string, from?: string, to?: string) {
  requireCanReport(session);
  const p = await projectByName(tenantId, projectName);
  if (!p) return { ok: false as const, errors: [`Project not found: ${projectName}`] };
  if (from && to && from > to) return { ok: false as const, errors: ["The start date is after the end date."] };

  const F = await periodFacts(tenantId, p.id, from, to);
  const byCat: Record<string, number> = {};
  for (const r of F.exp) {
    const k = r.category.trim() || "(uncategorised)";
    byCat[k] = (byCat[k] || 0) + n(r.amount);
  }
  const grossPay = F.pay.reduce((s, r) => s + grossPayroll(r), 0);
  if (grossPay) byCat["Labor / Payroll"] = grossPay;

  return {
    ok: true as const,
    project: p,
    range: rangeLabel(from, to),
    dated: !!(from || to),
    facts: F,
    categoryBreakdown: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    toDateBalance: n(p.contract) - F.toDateCollected,
    toDateNet: F.toDateCollected - F.toDateExpenses,
  };
}

export async function renderProjectReport(tenantId: string, session: Session, projectName: string, from?: string, to?: string) {
  requireCanReport(session);
  const p = await projectByName(tenantId, projectName);
  if (!p) return { ok: false as const, errors: [`Project not found: ${projectName}`] };
  if (from && to && from > to) return { ok: false as const, errors: ["The start date is after the end date."] };

  const F = await periodFacts(tenantId, p.id, from, to);
  return {
    ok: true as const,
    project: p,
    range: rangeLabel(from, to),
    dated: !!(from || to),
    facts: F,
    toDateBalance: n(p.contract) - F.toDateCollected,
  };
}

export async function renderPeriodReport(tenantId: string, session: Session, from?: string, to?: string) {
  requireCanReport(session);
  if (from && to && from > to) return { ok: false as const, errors: ["The start date is after the end date."] };

  const range = dateRange(from, to);
  const [exp, pay, col] = await Promise.all([
    db.expense.findMany({ where: { tenantId, voidedAt: null, ...(range ? { date: range } : {}) }, include: { project: { select: { name: true } } } }),
    db.payroll.findMany({ where: { tenantId, voidedAt: null, ...(range ? { payDate: range } : {}) }, include: { project: { select: { name: true } } } }),
    db.collection.findMany({ where: { tenantId, voidedAt: null, ...(range ? { date: range } : {}) }, include: { project: { select: { name: true } } } }),
  ]);

  const totExp = exp.reduce((s, r) => s + n(r.amount), 0);
  const totPay = pay.reduce((s, r) => s + grossPayroll(r), 0);
  const totBil = col.reduce((s, r) => s + n(r.billAmount), 0);
  const totEwt = col.reduce((s, r) => s + n(r.ewt), 0);
  const totCol = col.reduce((s, r) => s + netCollection(r), 0);
  const cost = totExp + totPay;
  const net = totCol - cost;

  const byProj: Record<string, { collected: number; cost: number }> = {};
  const slot = (name: string) => (byProj[name] ||= { collected: 0, cost: 0 });
  for (const r of exp) slot(r.project.name).cost += n(r.amount);
  for (const r of pay) slot(r.project.name).cost += grossPayroll(r);
  for (const r of col) slot(r.project.name).collected += netCollection(r);

  const byProject = Object.entries(byProj)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({
      name, collected: v.collected, cost: v.cost, net: v.collected - v.cost,
      margin: v.collected ? (v.collected - v.cost) / v.collected : 0,
    }));

  const byCat: Record<string, number> = {};
  for (const r of exp) {
    const k = r.category.trim() || "(uncategorised)";
    byCat[k] = (byCat[k] || 0) + n(r.amount);
  }
  if (totPay) byCat["Labor / Payroll"] = totPay;

  return {
    ok: true as const,
    range: rangeLabel(from, to),
    totBil, totEwt, totCol, totExp, totPay, cost, net,
    byProject,
    byCategory: Object.entries(byCat).sort((a, b) => b[1] - a[1]),
    collections: col.map((c) => ({
      date: c.date, project: c.project.name, particulars: c.particulars,
      billed: n(c.billAmount), ewt: n(c.ewt), received: netCollection(c), depositedTo: c.depositedTo,
    })).sort((a, b) => a.date.getTime() - b.date.getTime()),
    entries: exp.length + pay.length + col.length,
  };
}
