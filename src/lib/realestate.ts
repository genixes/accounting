import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { findRate, type FxQuote } from "@/lib/finance/fx";
import { isCurrency, round } from "@/lib/finance/money";
import { validateLines, incomeStatement, cashFlow, type ReportLine, type PostingLine } from "@/lib/finance/ledger";
import { canTransition, isOwnedStage, STAGE_LABEL, type Stage } from "@/lib/finance/lifecycle";
import { capRate, occupancy } from "@/lib/finance/metrics";
import { balanceAfter, paymentFor, paymentsElapsed } from "@/lib/finance/amortization";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Chart of accounts
// ---------------------------------------------------------------------------

type ChartSeed = { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"; isCash?: boolean };

export const DEFAULT_CHART: ChartSeed[] = [
  { code: "1000", name: "Cash & Bank", type: "ASSET", isCash: true },
  { code: "1500", name: "Real Property", type: "ASSET" },
  { code: "2000", name: "Mortgage / Loans Payable", type: "LIABILITY" },
  { code: "2100", name: "Tenant Deposits", type: "LIABILITY" },
  { code: "3000", name: "Owner / Investor Capital", type: "EQUITY" },
  { code: "4000", name: "Rental Income", type: "INCOME" },
  { code: "4100", name: "Other Income", type: "INCOME" },
  { code: "4900", name: "Gain on Sale", type: "INCOME" },
  { code: "5000", name: "Repairs & Maintenance", type: "EXPENSE" },
  { code: "5100", name: "Property Tax", type: "EXPENSE" },
  { code: "5200", name: "Insurance", type: "EXPENSE" },
  { code: "5300", name: "Utilities", type: "EXPENSE" },
  { code: "5400", name: "Management Fees", type: "EXPENSE" },
  { code: "5500", name: "Loan Interest", type: "EXPENSE" },
  { code: "5900", name: "Other Expense", type: "EXPENSE" },
];

export async function ensureChart(tx: Prisma.TransactionClient, tenantId: string) {
  for (const a of DEFAULT_CHART) {
    await tx.ledgerAccount.upsert({
      where: { tenantId_code: { tenantId, code: a.code } },
      update: {},
      create: { tenantId, code: a.code, name: a.name, type: a.type, isCash: !!a.isCash },
    });
  }
}

// ---------------------------------------------------------------------------
// Transactions a user can post. Each maps to a fixed debit/credit pair so a
// user never has to know double-entry to keep correct books.
// ---------------------------------------------------------------------------

export const TXN_KINDS = {
  RENT_RECEIVED: { label: "Rent received", debit: "1000", credit: "4000" },
  OTHER_INCOME: { label: "Other income", debit: "1000", credit: "4100" },
  DEPOSIT_RECEIVED: { label: "Tenant deposit received", debit: "1000", credit: "2100" },
  REPAIRS: { label: "Repairs & maintenance", debit: "5000", credit: "1000" },
  PROPERTY_TAX: { label: "Property tax", debit: "5100", credit: "1000" },
  INSURANCE: { label: "Insurance", debit: "5200", credit: "1000" },
  UTILITIES: { label: "Utilities", debit: "5300", credit: "1000" },
  MGMT_FEE: { label: "Management fee", debit: "5400", credit: "1000" },
  LOAN_INTEREST: { label: "Loan interest", debit: "5500", credit: "1000" },
  LOAN_PRINCIPAL: { label: "Loan principal payment", debit: "2000", credit: "1000" },
  OTHER_EXPENSE: { label: "Other expense", debit: "5900", credit: "1000" },
  CAPITAL_IN: { label: "Capital contributed", debit: "1000", credit: "3000" },
  CAPITAL_OUT: { label: "Distribution to owners", debit: "3000", credit: "1000" },
  LOAN_PROCEEDS: { label: "Loan proceeds", debit: "1000", credit: "2000" },
  PURCHASE: { label: "Property purchase", debit: "1500", credit: "1000" },
} as const;
export type TxnKind = keyof typeof TXN_KINDS;
export const isTxnKind = (k: string): k is TxnKind => k in TXN_KINDS;

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

export async function loadQuotes(tenantId: string): Promise<FxQuote[]> {
  const rows = await db.fxRate.findMany({ where: { tenantId } });
  return rows.map((r) => ({ from: r.fromCcy, to: r.toCcy, rate: Number(r.rate), asOf: r.asOf }));
}

export async function addFxRate(
  session: Session,
  input: { from: string; to: string; rate: number; asOf: Date }
): Promise<Result> {
  const from = input.from.toUpperCase();
  const to = input.to.toUpperCase();
  if (!isCurrency(from) || !isCurrency(to)) return { ok: false, error: "Unsupported currency code." };
  if (from === to) return { ok: false, error: "Pick two different currencies." };
  if (!(input.rate > 0) || !Number.isFinite(input.rate)) return { ok: false, error: "Rate must be greater than zero." };
  await db.$transaction(async (tx) => {
    await tx.fxRate.create({ data: { tenantId: session.tenantId, fromCcy: from, toCcy: to, rate: input.rate, asOf: input.asOf } });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "FX_RATE", null, null, `${from}->${to} ${input.rate}`);
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export type NewPropertyInput = {
  name: string; type: string; currency: string; address?: string; city?: string; country?: string;
  purchasePrice?: number | null; purchaseDate?: Date | null; closingCosts?: number; currentValue?: number | null; notes?: string;
};

const PROPERTY_TYPES = ["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "LAND", "MIXED_USE"] as const;

export async function createProperty(session: Session, input: NewPropertyInput): Promise<Result<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Property name is required." };
  if (!(PROPERTY_TYPES as readonly string[]).includes(input.type)) return { ok: false, error: "Invalid property type." };
  const currency = input.currency.toUpperCase();
  if (!isCurrency(currency)) return { ok: false, error: "Unsupported currency." };
  for (const v of [input.purchasePrice, input.closingCosts, input.currentValue]) {
    if (v != null && (!Number.isFinite(v) || v < 0)) return { ok: false, error: "Amounts cannot be negative." };
  }
  const dupe = await db.realProperty.findUnique({ where: { tenantId_name: { tenantId: session.tenantId, name } } });
  if (dupe) return { ok: false, error: `A property named "${name}" already exists.` };

  const p = await db.$transaction(async (tx) => {
    await ensureChart(tx, session.tenantId);
    const created = await tx.realProperty.create({
      data: {
        tenantId: session.tenantId, name, type: input.type as (typeof PROPERTY_TYPES)[number], currency,
        address: input.address?.trim() || null, city: input.city?.trim() || null, country: input.country?.trim() || null,
        purchasePrice: input.purchasePrice ?? null, purchaseDate: input.purchaseDate ?? null,
        closingCosts: input.closingCosts ?? 0, currentValue: input.currentValue ?? null, notes: input.notes?.trim() || null,
        stageEvents: { create: { toStage: "PROSPECT", byName: session.name, note: "Created" } },
      },
    });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "PROPERTY_ADD", "PROPERTY", created.id, name);
    return created;
  });
  return { ok: true, id: p.id };
}

export async function changeStage(
  session: Session,
  propertyId: string,
  to: Stage,
  note: string,
  salePrice?: number | null
): Promise<Result> {
  const p = await db.realProperty.findFirst({ where: { id: propertyId, tenantId: session.tenantId } });
  if (!p) return { ok: false, error: "Property not found." };
  const from = p.stage as Stage;
  if (!canTransition(from, to)) return { ok: false, error: `Cannot move from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}.` };
  if (to === "SOLD" && (salePrice == null || !(salePrice > 0))) return { ok: false, error: "Enter the sale price to mark as sold." };
  await db.$transaction(async (tx) => {
    await tx.realProperty.update({
      where: { id: p.id },
      data: { stage: to, ...(to === "SOLD" ? { salePrice, soldDate: new Date() } : {}) },
    });
    await tx.propertyStageEvent.create({ data: { propertyId: p.id, fromStage: from, toStage: to, byName: session.name, note: note.trim() || null } });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "PROPERTY_STAGE", "PROPERTY", p.id, `${from}->${to}`);
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Journal posting
// ---------------------------------------------------------------------------

async function nextJournalNo(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "EntrySequence" ("tenantId", "register", "year", "lastNumber")
    VALUES (${tenantId}, 'JOURNAL', ${year}, 1)
    ON CONFLICT ("tenantId", "register", "year")
    DO UPDATE SET "lastNumber" = "EntrySequence"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  return `JE-${year}-${String(rows[0].lastNumber).padStart(6, "0")}`;
}

export async function postTransaction(
  session: Session,
  baseCurrency: string,
  input: { propertyId: string; kind: string; date: Date; amount: number; memo: string }
): Promise<Result<{ entryNo: string }>> {
  if (!isTxnKind(input.kind)) return { ok: false, error: "Unknown transaction type." };
  if (!(input.amount > 0) || !Number.isFinite(input.amount)) return { ok: false, error: "Amount must be greater than zero." };
  if (Number.isNaN(input.date.getTime())) return { ok: false, error: "Invalid date." };
  const memo = input.memo.trim();
  if (!memo) return { ok: false, error: "Add a short description." };

  const prop = await db.realProperty.findFirst({ where: { id: input.propertyId, tenantId: session.tenantId } });
  if (!prop) return { ok: false, error: "Property not found." };
  const stage = prop.stage as Stage;
  if (input.kind === "PURCHASE" ? stage === "SOLD" : !isOwnedStage(stage) && !(input.kind === "CAPITAL_IN" || input.kind === "LOAN_PROCEEDS")) {
    return { ok: false, error: `Transactions can't be booked while the property is "${STAGE_LABEL[stage]}".` };
  }

  const fx = findRate(await loadQuotes(session.tenantId), prop.currency, baseCurrency, input.date);
  if (fx === null) return { ok: false, error: `Add an FX rate for ${prop.currency} → ${baseCurrency} first (on or before ${input.date.toISOString().slice(0, 10)}).` };

  const kind = TXN_KINDS[input.kind];
  const amount = round(input.amount);

  return db.$transaction(async (tx) => {
    await ensureChart(tx, session.tenantId);
    const accts = await tx.ledgerAccount.findMany({ where: { tenantId: session.tenantId, code: { in: [kind.debit, kind.credit] } } });
    const id = (code: string) => accts.find((a) => a.code === code)!.id;
    const lines: PostingLine[] = [
      { accountId: id(kind.debit), debit: amount, credit: 0 },
      { accountId: id(kind.credit), debit: 0, credit: amount },
    ];
    const bad = validateLines(lines);
    if (bad) return { ok: false as const, error: bad };

    const entryNo = await nextJournalNo(tx, session.tenantId);
    await tx.journalEntry.create({
      data: {
        tenantId: session.tenantId, entryNo, date: input.date, memo: `${kind.label}: ${memo}`.slice(0, 300),
        propertyId: prop.id, currency: prop.currency, fxToBase: fx, byUserId: session.userId, byName: session.name,
        lines: { create: lines },
      },
    });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "JOURNAL_ADD", "JOURNAL", entryNo, `${prop.name} ${kind.label} ${amount} ${prop.currency}`);
    return { ok: true as const, entryNo };
  });
}

export async function voidEntry(session: Session, entryId: string, reason: string): Promise<Result> {
  if (!session.perms.canVoid) return { ok: false, error: "Your role cannot void entries." };
  if (!reason.trim()) return { ok: false, error: "A reason is required to void." };
  const e = await db.journalEntry.findFirst({ where: { id: entryId, tenantId: session.tenantId } });
  if (!e) return { ok: false, error: "Entry not found." };
  if (e.voidedAt) return { ok: false, error: "Entry is already void." };
  await db.$transaction(async (tx) => {
    await tx.journalEntry.update({ where: { id: e.id }, data: { voidedAt: new Date(), voidReason: reason.trim() } });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "JOURNAL_VOID", "JOURNAL", e.entryNo, reason.trim());
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Units & leases, investors
// ---------------------------------------------------------------------------

export async function addUnitWithLease(
  session: Session,
  input: { propertyId: string; label: string; marketRent: number; tenantName?: string; monthlyRent?: number; deposit?: number; startDate?: Date; endDate?: Date | null }
): Promise<Result> {
  const prop = await db.realProperty.findFirst({ where: { id: input.propertyId, tenantId: session.tenantId } });
  if (!prop) return { ok: false, error: "Property not found." };
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Unit label is required." };
  if (!(input.marketRent >= 0)) return { ok: false, error: "Market rent cannot be negative." };
  const hasLease = !!input.tenantName?.trim();
  if (hasLease && (!(input.monthlyRent! > 0) || !input.startDate)) return { ok: false, error: "A lease needs a monthly rent and start date." };
  try {
    await db.$transaction(async (tx) => {
      const unit = await tx.unit.create({ data: { propertyId: prop.id, label, marketRent: input.marketRent } });
      if (hasLease) {
        await tx.lease.create({
          data: { unitId: unit.id, tenantName: input.tenantName!.trim(), monthlyRent: input.monthlyRent!, deposit: input.deposit ?? 0, startDate: input.startDate!, endDate: input.endDate ?? null },
        });
      }
      await audit(tx, session.tenantId, session.userId, session.name, session.role, "UNIT_ADD", "PROPERTY", prop.id, `${label}${hasLease ? " + lease" : ""}`);
    });
  } catch {
    return { ok: false, error: `Unit "${label}" already exists on this property.` };
  }
  return { ok: true };
}

export async function setStakes(
  session: Session,
  propertyId: string,
  stakes: { investor: string; percent: number }[]
): Promise<Result> {
  const t = await db.tenant.findUnique({ where: { id: session.tenantId } });
  if (t?.investorMode !== "SYNDICATION") return { ok: false, error: "Investor stakes are only available in syndication mode." };
  const prop = await db.realProperty.findFirst({ where: { id: propertyId, tenantId: session.tenantId } });
  if (!prop) return { ok: false, error: "Property not found." };
  const rows = stakes.filter((s) => s.investor.trim());
  if (!rows.length) return { ok: false, error: "Add at least one investor." };
  if (rows.some((s) => !(s.percent > 0) || s.percent > 100)) return { ok: false, error: "Each stake must be between 0 and 100%." };
  if (new Set(rows.map((s) => s.investor.trim().toLowerCase())).size !== rows.length) return { ok: false, error: "An investor appears twice." };
  if (round(rows.reduce((s, r) => s + r.percent, 0), 4) !== 100) return { ok: false, error: "Stakes must total exactly 100%." };

  await db.$transaction(async (tx) => {
    await tx.propertyStake.deleteMany({ where: { propertyId } });
    for (const r of rows) {
      const name = r.investor.trim();
      const inv = await tx.investor.upsert({
        where: { tenantId_name: { tenantId: session.tenantId, name } }, update: {}, create: { tenantId: session.tenantId, name },
      });
      await tx.propertyStake.create({ data: { investorId: inv.id, propertyId, percent: r.percent } });
    }
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "STAKES_SET", "PROPERTY", propertyId, rows.map((r) => `${r.investor} ${r.percent}%`).join(", "));
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const num = (d: Prisma.Decimal | number | null | undefined) => (d == null ? 0 : Number(d));

export async function getPropertyReport(tenantId: string, propertyId: string, from: Date, to: Date) {
  const rows = await db.journalLine.findMany({
    where: { entry: { tenantId, propertyId, voidedAt: null, date: { gte: from, lte: to } } },
    include: { account: true },
  });
  const lines: ReportLine[] = rows.map((r) => ({
    accountId: r.accountId, code: r.account.code, name: r.account.name, type: r.account.type,
    debit: num(r.debit), credit: num(r.credit),
  }));
  const cashIds = new Set(rows.filter((r) => r.account.isCash).map((r) => r.accountId));
  return { pl: incomeStatement(lines), cash: cashFlow(lines, cashIds) };
}

export type PortfolioRow = {
  id: string; name: string; type: string; stage: Stage; currency: string; city: string | null;
  valueBase: number | null; noiBase: number; unitCount: number; occupiedUnits: number; monthlyRentBase: number | null;
  capRate: number | null; fxMissing: boolean;
};

export async function getPortfolio(tenantId: string, baseCurrency: string, yearStart: Date, today = new Date()) {
  const [props, quotes, lines] = await Promise.all([
    db.realProperty.findMany({
      where: { tenantId }, orderBy: { name: "asc" },
      include: { units: { include: { leases: { where: { endedAt: null } } } } },
    }),
    loadQuotes(tenantId),
    db.journalLine.findMany({
      where: { entry: { tenantId, voidedAt: null, propertyId: { not: null }, date: { gte: yearStart, lte: today } }, account: { type: { in: ["INCOME", "EXPENSE"] } } },
      include: { account: true, entry: { select: { propertyId: true, fxToBase: true } } },
    }),
  ]);

  const noiBy = new Map<string, number>();
  for (const l of lines) {
    // Income grows with credits, expenses with debits, so credit - debit is NOI either way.
    const signed = num(l.credit) - num(l.debit);
    const pid = l.entry.propertyId!;
    noiBy.set(pid, (noiBy.get(pid) ?? 0) + signed * num(l.entry.fxToBase));
  }

  const rows: PortfolioRow[] = props.map((p) => {
    const rate = findRate(quotes, p.currency, baseCurrency, today);
    const value = p.currentValue ?? p.purchasePrice;
    const occupied = p.units.filter((u) => u.leases.length > 0).length;
    const rent = p.units.reduce((s, u) => s + u.leases.reduce((a, l) => a + num(l.monthlyRent), 0), 0);
    const noi = round(noiBy.get(p.id) ?? 0);
    const valueBase = value != null && rate !== null ? round(num(value) * rate) : null;
    // NOI is year-to-date; annualise by elapsed fraction of the year for a fair cap rate.
    const frac = Math.max((today.getTime() - yearStart.getTime()) / (365 * 86_400_000), 1 / 12);
    return {
      id: p.id, name: p.name, type: p.type, stage: p.stage as Stage, currency: p.currency, city: p.city,
      valueBase, noiBase: noi, unitCount: p.units.length, occupiedUnits: occupied,
      monthlyRentBase: rate !== null ? round(rent * rate) : null,
      capRate: valueBase ? capRate(noi / frac, valueBase) : null,
      fxMissing: rate === null,
    };
  });

  const owned = rows.filter((r) => r.stage !== "SOLD" && r.stage !== "PROSPECT");
  const units = rows.reduce((s, r) => s + r.unitCount, 0);
  const occ = rows.reduce((s, r) => s + r.occupiedUnits, 0);
  return {
    rows,
    totals: {
      valueBase: round(owned.reduce((s, r) => s + (r.valueBase ?? 0), 0)),
      noiBase: round(rows.reduce((s, r) => s + r.noiBase, 0)),
      monthlyRentBase: round(rows.reduce((s, r) => s + (r.monthlyRentBase ?? 0), 0)),
      occupancy: occupancy(occ, units),
      fxMissing: rows.some((r) => r.fxMissing),
    },
  };
}

// ---------------------------------------------------------------------------
// Loans (HOLD)
// ---------------------------------------------------------------------------

export async function addLoan(
  session: Session,
  input: { propertyId: string; lender: string; principal: number; annualRatePct: number; termYears: number; startDate: Date }
): Promise<Result> {
  const prop = await db.realProperty.findFirst({ where: { id: input.propertyId, tenantId: session.tenantId } });
  if (!prop) return { ok: false, error: "Property not found." };
  const lender = input.lender.trim();
  if (!lender) return { ok: false, error: "Lender is required." };
  if (!(input.principal > 0) || !Number.isFinite(input.principal)) return { ok: false, error: "Principal must be greater than zero." };
  if (!(input.annualRatePct >= 0 && input.annualRatePct < 100)) return { ok: false, error: "Interest rate must be between 0% and 100%." };
  if (!(Number.isInteger(input.termYears) && input.termYears >= 1 && input.termYears <= 50)) return { ok: false, error: "Term must be a whole number of years (1–50)." };
  if (Number.isNaN(input.startDate.getTime())) return { ok: false, error: "Invalid start date." };
  await db.$transaction(async (tx) => {
    await tx.loan.create({
      data: { propertyId: prop.id, lender, principal: round(input.principal), annualRate: input.annualRatePct / 100, termYears: input.termYears, startDate: input.startDate },
    });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "LOAN_ADD", "PROPERTY", prop.id, `${lender} ${input.principal}`);
  });
  return { ok: true };
}

export type LoanStatus = {
  id: string; lender: string; principal: number; annualRate: number; termYears: number; startDate: Date;
  monthlyPayment: number; paid: number; totalPayments: number; balance: number;
};

export function loanStatus(
  l: { id: string; lender: string; principal: Prisma.Decimal; annualRate: Prisma.Decimal; termYears: number; paymentsPerYear: number; startDate: Date },
  asOf = new Date()
): LoanStatus {
  const terms = { principal: Number(l.principal), annualRate: Number(l.annualRate), years: l.termYears, paymentsPerYear: l.paymentsPerYear };
  const paid = paymentsElapsed(l.startDate, asOf, l.termYears, l.paymentsPerYear);
  return {
    id: l.id, lender: l.lender, principal: terms.principal, annualRate: terms.annualRate, termYears: l.termYears, startDate: l.startDate,
    monthlyPayment: round(paymentFor(terms)), paid, totalPayments: Math.round(l.termYears * l.paymentsPerYear), balance: balanceAfter(terms, paid),
  };
}
