// Things that need an owner's attention, derived from the data on demand
// (no alert table to go stale).

export type AlertKind = "LEASE_ENDING" | "DOCUMENT_EXPIRING" | "LOAN_MATURING" | "VACANT_UNIT";
export type Severity = "overdue" | "soon" | "upcoming";

export type Alert = {
  kind: AlertKind; severity: Severity; propertyId: string; propertyName: string;
  title: string; detail: string; date: Date | null; days: number | null;
};

export type AlertInput = {
  today: Date;
  /** Look-ahead window; items further out are ignored. */
  horizonDays?: number;
  leases: { propertyId: string; propertyName: string; unit: string; tenantName: string; endDate: Date | null }[];
  documents: { propertyId: string | null; propertyName: string | null; name: string; category: string; expiresOn: Date | null }[];
  loans: { propertyId: string; propertyName: string; lender: string; startDate: Date; termYears: number }[];
  vacancies: { propertyId: string; propertyName: string; unit: string }[];
};

const DAY = 86_400_000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export const daysUntil = (date: Date, today: Date) => Math.round((utcDay(date) - utcDay(today)) / DAY);

export const severityFor = (days: number): Severity => (days < 0 ? "overdue" : days <= 30 ? "soon" : "upcoming");

const when = (days: number) =>
  days < 0 ? `${-days} day${days === -1 ? "" : "s"} overdue` : days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`;

const RANK: Record<Severity, number> = { overdue: 0, soon: 1, upcoming: 2 };

export function buildAlerts(i: AlertInput): Alert[] {
  const horizon = i.horizonDays ?? 90;
  const out: Alert[] = [];
  const dated = (
    kind: AlertKind, propertyId: string, propertyName: string, title: string, label: string, date: Date,
  ) => {
    const days = daysUntil(date, i.today);
    if (days > horizon) return;
    out.push({ kind, severity: severityFor(days), propertyId, propertyName, title, detail: `${label} ${when(days)}`, date, days });
  };

  for (const l of i.leases) if (l.endDate) dated("LEASE_ENDING", l.propertyId, l.propertyName, `Lease ends — ${l.unit} (${l.tenantName})`, "Ends", l.endDate);
  for (const d of i.documents) if (d.expiresOn && d.propertyId) dated("DOCUMENT_EXPIRING", d.propertyId, d.propertyName ?? "", `${d.category.toLowerCase()} expires — ${d.name}`, "Expires", d.expiresOn);
  for (const l of i.loans) {
    const end = new Date(Date.UTC(l.startDate.getUTCFullYear() + l.termYears, l.startDate.getUTCMonth(), l.startDate.getUTCDate()));
    dated("LOAN_MATURING", l.propertyId, l.propertyName, `Loan matures — ${l.lender}`, "Matures", end);
  }
  for (const v of i.vacancies) {
    out.push({ kind: "VACANT_UNIT", severity: "upcoming", propertyId: v.propertyId, propertyName: v.propertyName, title: `Vacant — ${v.unit}`, detail: "No active lease", date: null, days: null });
  }
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.days ?? 1e9) - (b.days ?? 1e9) || a.title.localeCompare(b.title));
}
