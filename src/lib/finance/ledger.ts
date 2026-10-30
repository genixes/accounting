import { round } from "./money";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export type PostingLine = { accountId: string; debit: number; credit: number };

/** A journal entry is valid only if every line is one-sided and debits equal credits. */
export function validateLines(lines: PostingLine[]): string | null {
  if (lines.length < 2) return "An entry needs at least two lines.";
  let d = 0;
  let c = 0;
  for (const l of lines) {
    if (l.debit < 0 || l.credit < 0) return "Debit and credit cannot be negative.";
    if ((l.debit > 0) === (l.credit > 0)) return "Each line must be either a debit or a credit.";
    d += l.debit;
    c += l.credit;
  }
  if (round(d) !== round(c)) return `Entry is out of balance (debits ${round(d)}, credits ${round(c)}).`;
  return null;
}

/** Natural-sign balance: assets/expenses grow with debits, the rest with credits. */
export function naturalBalance(type: AccountType, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}

export type ReportLine = { accountId: string; code: string; name: string; type: AccountType; debit: number; credit: number };
export type StatementRow = { code: string; name: string; amount: number };
export type IncomeStatement = {
  income: StatementRow[];
  expenses: StatementRow[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
};

/** Profit & Loss from already-filtered (voided excluded, in-period) lines. */
export function incomeStatement(lines: ReportLine[]): IncomeStatement {
  const acc = new Map<string, StatementRow & { type: AccountType }>();
  for (const l of lines) {
    if (l.type !== "INCOME" && l.type !== "EXPENSE") continue;
    const row = acc.get(l.accountId) ?? { code: l.code, name: l.name, amount: 0, type: l.type };
    row.amount += naturalBalance(l.type, l.debit, l.credit);
    acc.set(l.accountId, row);
  }
  const rows = [...acc.values()].map((r) => ({ ...r, amount: round(r.amount) })).sort((a, b) => a.code.localeCompare(b.code));
  const income = rows.filter((r) => r.type === "INCOME");
  const expenses = rows.filter((r) => r.type === "EXPENSE");
  const totalIncome = round(income.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round(expenses.reduce((s, r) => s + r.amount, 0));
  return {
    income: income.map(({ code, name, amount }) => ({ code, name, amount })),
    expenses: expenses.map(({ code, name, amount }) => ({ code, name, amount })),
    totalIncome,
    totalExpenses,
    netIncome: round(totalIncome - totalExpenses),
  };
}

export type CashFlowStatement = { inflows: number; outflows: number; net: number };

/** Cash movement = net debit/credit on the cash & bank accounts (`cashAccountIds`). */
export function cashFlow(lines: { accountId: string; debit: number; credit: number }[], cashAccountIds: Set<string>): CashFlowStatement {
  let inflows = 0;
  let outflows = 0;
  for (const l of lines) {
    if (!cashAccountIds.has(l.accountId)) continue;
    inflows += l.debit;
    outflows += l.credit;
  }
  return { inflows: round(inflows), outflows: round(outflows), net: round(inflows - outflows) };
}
