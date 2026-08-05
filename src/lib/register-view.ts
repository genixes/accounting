import "server-only";
import { db } from "@/lib/db";
import type { Session } from "@/lib/auth";
import type { RegisterKey } from "@/lib/roles";
import { n, grossPayroll, netCollection } from "@/lib/aggregate";

export type LedgerFilter = {
  project?: string;
  q?: string;
  hideVoided?: boolean;
  from?: string;
  to?: string;
  limit?: number;
};

export type LedgerRow = {
  id: string;
  date: string;
  label: string;
  project: string;
  by: string;
  amount: number;
  voided: boolean;
};

/** Ported from Dashboard.gs getRegister(). Filtering happens server-side so a
 *  large register never gets shipped whole to the browser. */
export async function getRegisterRows(tenantId: string, session: Session, regKey: RegisterKey, filter: LedgerFilter) {
  const limit = filter.limit || 100;
  const q = (filter.q || "").toLowerCase().trim();

  let rows: LedgerRow[] = [];

  if (regKey === "EXPENSES") {
    const data = await db.expense.findMany({
      where: { tenantId }, include: { project: { select: { name: true } } }, orderBy: { at: "desc" },
    });
    rows = data.map((r) => ({ id: r.entryId, date: r.date.toISOString().slice(0, 10), label: r.particulars, project: r.project.name, by: r.byName, amount: n(r.amount), voided: !!r.voidedAt }));
  } else if (regKey === "PAYROLL") {
    const data = await db.payroll.findMany({
      where: { tenantId }, include: { project: { select: { name: true } } }, orderBy: { at: "desc" },
    });
    rows = data.map((r) => ({ id: r.entryId, date: r.payDate.toISOString().slice(0, 10), label: r.payPeriod, project: r.project.name, by: r.byName, amount: grossPayroll(r), voided: !!r.voidedAt }));
  } else if (regKey === "COLLECTION") {
    const data = await db.collection.findMany({
      where: { tenantId }, include: { project: { select: { name: true } } }, orderBy: { at: "desc" },
    });
    rows = data.map((r) => ({ id: r.entryId, date: r.date.toISOString().slice(0, 10), label: r.particulars, project: r.project.name, by: r.byName, amount: netCollection(r), voided: !!r.voidedAt }));
  } else {
    const data = await db.transfer.findMany({ where: { tenantId }, orderBy: { at: "desc" } });
    rows = data.map((r) => ({ id: r.entryId, date: r.date.toISOString().slice(0, 10), label: r.particulars, project: "", by: r.byName, amount: n(r.amount), voided: !!r.voidedAt }));
  }

  const out = rows.filter((r) => {
    if (!session.perms.seeAllEntries && r.by !== session.name) return false;
    if (filter.project && r.project !== filter.project) return false;
    if (filter.hideVoided && r.voided) return false;
    if (filter.from && r.date < filter.from) return false;
    if (filter.to && r.date > filter.to) return false;
    if (q) {
      const hay = `${r.id} ${r.label} ${r.project} ${r.by}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).slice(0, limit);

  return {
    rows: out,
    canVoid: session.perms.canVoid,
    liveTotal: out.filter((r) => !r.voided).reduce((s, r) => s + r.amount, 0),
  };
}
