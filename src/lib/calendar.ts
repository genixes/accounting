import "server-only";
import type { Session } from "@/lib/auth";
import { scanAll, expenseFact, payrollFact, collectionFact, transferFact, type RowFact } from "@/lib/aggregate";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Ported from Dashboard.gs getCalendar(). One month of activity, grouped by
 *  day, each day carrying totals and its own entries. */
export async function getCalendar(tenantId: string, session: Session, year: number, month: number) {
  const all = await scanAll(tenantId);
  const facts: RowFact[] = [
    ...all.expenses.map(expenseFact),
    ...all.payrolls.map(payrollFact),
    ...all.collections.map(collectionFact),
    ...all.transfers.map(transferFact),
  ];

  const days: Record<string, { in: number; out: number; entries: RowFact[] }> = {};
  let monthIn = 0, monthOut = 0, count = 0;

  for (const f of facts) {
    const day = iso(f.date);
    const [y, m] = day.split("-").map(Number);
    if (y !== year || m !== month) continue;
    if (!session.perms.seeAllEntries && f.by !== session.name) continue;

    if (!days[day]) days[day] = { in: 0, out: 0, entries: [] };
    days[day].entries.push(f);
    if (!f.voided) {
      count++;
      if (f.dir === "in") { days[day].in += f.amount; monthIn += f.amount; }
      if (f.dir === "out") { days[day].out += f.amount; monthOut += f.amount; }
    }
  }

  for (const day of Object.values(days)) {
    day.entries.sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  return {
    year, month, days,
    totals: { in: monthIn, out: monthOut, net: monthIn - monthOut, count },
  };
}
