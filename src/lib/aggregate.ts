import "server-only";
import { db } from "@/lib/db";
import type { Prisma, Transfer } from "@prisma/client";

export function n(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const num = typeof v === "object" && v !== null && "toNumber" in v
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v);
  return isNaN(num) ? 0 : num;
}

export function grossPayroll(p: { regularPay: unknown; otPay: unknown }) {
  return n(p.regularPay) + n(p.otPay);
}

export function netPayroll(p: { regularPay: unknown; otPay: unknown; caGiven: unknown; deductions: unknown; caDeduction: unknown }) {
  return grossPayroll(p) + n(p.caGiven) - n(p.deductions) - n(p.caDeduction);
}

export function netCollection(c: { billAmount: unknown; ewt: unknown }) {
  return n(c.billAmount) - n(c.ewt);
}

export type ExpenseRow = Prisma.ExpenseGetPayload<{ include: { project: { select: { name: true } } } }>;
export type PayrollRow = Prisma.PayrollGetPayload<{ include: { project: { select: { name: true } } } }>;
export type CollectionRow = Prisma.CollectionGetPayload<{ include: { project: { select: { name: true } } } }>;
export type TransferRow = Transfer;

/** All rows of all four registers for a tenant, live and voided both — the
 *  same "read once, reuse" shape as scanAll_() in Dashboard.gs. Callers
 *  filter voidedAt themselves depending on whether they want live-only. */
export async function scanAll(tenantId: string) {
  const [expenses, payrolls, collections, transfers] = await Promise.all([
    db.expense.findMany({ where: { tenantId }, include: { project: { select: { name: true } } } }),
    db.payroll.findMany({ where: { tenantId }, include: { project: { select: { name: true } } } }),
    db.collection.findMany({ where: { tenantId }, include: { project: { select: { name: true } } } }),
    db.transfer.findMany({ where: { tenantId } }),
  ]);
  return { expenses, payrolls, collections, transfers };
}

export function isLive<T extends { voidedAt: Date | null }>(row: T) {
  return row.voidedAt === null;
}

export type RowFact = {
  id: string;
  register: "EXPENSES" | "PAYROLL" | "COLLECTION" | "TRANSFERS";
  date: Date;
  label: string;
  project: string;
  amount: number;
  dir: "in" | "out" | "move";
  by: string;
  voided: boolean;
};

export function expenseFact(r: ExpenseRow): RowFact {
  return {
    id: r.entryId, register: "EXPENSES", date: r.date, label: r.particulars,
    project: r.project.name, amount: n(r.amount), dir: "out", by: r.byName, voided: !isLive(r),
  };
}
export function payrollFact(r: PayrollRow): RowFact {
  return {
    id: r.entryId, register: "PAYROLL", date: r.payDate, label: r.payPeriod,
    project: r.project.name, amount: grossPayroll(r), dir: "out", by: r.byName, voided: !isLive(r),
  };
}
export function collectionFact(r: CollectionRow): RowFact {
  return {
    id: r.entryId, register: "COLLECTION", date: r.date, label: r.particulars,
    project: r.project.name, amount: netCollection(r), dir: "in", by: r.byName, voided: !isLive(r),
  };
}
export function transferFact(r: TransferRow): RowFact {
  return {
    id: r.entryId, register: "TRANSFERS", date: r.date, label: r.particulars,
    project: "", amount: n(r.amount), dir: "move", by: r.byName, voided: !isLive(r),
  };
}
