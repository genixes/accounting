import "server-only";
import type { Prisma } from "@prisma/client";
import type { RegisterKey } from "@/lib/roles";

export type FieldType = "date" | "text" | "money" | "select" | "textarea";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  list?: "projects" | "categories" | "accounts" | "suppliers" | "paymentMethods";
  half?: boolean;
  placeholder?: string;
};

export type RegisterConfig = {
  key: RegisterKey;
  title: string;
  plural: string;
  glyph: string;
  dir: "out" | "in" | "move";
  prefix: string;
  sub: string;
  note?: string;
  amountField: string;
  fields: FieldDef[];
  required: string[];
  money: string[];
};

// Ported from Code.gs REGISTERS + Index.html's REG (form UI config merged
// with server-side validation config — one source of truth for both).
export const REGISTERS: Record<RegisterKey, RegisterConfig> = {
  EXPENSES: {
    key: "EXPENSES",
    title: "Expense",
    plural: "Expenses",
    glyph: "E",
    dir: "out",
    prefix: "EXP",
    sub: "Money paid out. Materials, fuel, permits, equipment.",
    amountField: "amount",
    required: ["date", "particulars", "project", "category", "amount", "paidFrom"],
    money: ["amount"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "amount", label: "Amount", type: "money", required: true, half: true },
      { key: "particulars", label: "Particulars", type: "text", required: true, placeholder: "What was bought or paid for" },
      { key: "project", label: "Project", type: "select", required: true, list: "projects", half: true },
      { key: "category", label: "Category", type: "select", required: true, list: "categories", half: true },
      { key: "supplier", label: "Supplier", type: "select", list: "suppliers", half: true },
      { key: "invoice", label: "Invoice No.", type: "text", half: true },
      { key: "paidFrom", label: "Paid From", type: "select", required: true, list: "accounts" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },

  PAYROLL: {
    key: "PAYROLL",
    title: "Payroll",
    plural: "Payroll",
    glyph: "P",
    dir: "out",
    prefix: "PAY",
    sub: "One entry per pay period, per project.",
    note: "Gross and Net are computed by the ledger. There is no field for them here.",
    amountField: "regularPay",
    required: ["payPeriod", "payDate", "project", "regularPay", "paidBy"],
    money: ["regularPay", "otPay", "deductions", "caGiven", "caDeduction"],
    fields: [
      { key: "payPeriod", label: "Pay Period", type: "text", required: true, placeholder: "July 01-05, 2026", half: true },
      { key: "payDate", label: "Pay Date", type: "date", required: true, half: true },
      { key: "project", label: "Project", type: "select", required: true, list: "projects", half: true },
      { key: "workers", label: "No. of Workers", type: "text", half: true },
      { key: "regularPay", label: "Total Regular Pay", type: "money", required: true, half: true },
      { key: "otPay", label: "Total OT Pay", type: "money", half: true },
      { key: "deductions", label: "Total Deductions", type: "money", half: true },
      { key: "caGiven", label: "Cash Advance Given", type: "money", half: true },
      { key: "caDeduction", label: "Cash Advance Deducted", type: "money", half: true },
      { key: "paidBy", label: "Paid By", type: "select", required: true, list: "accounts", half: true },
      { key: "reference", label: "Reference / Voucher", type: "text" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },

  COLLECTION: {
    key: "COLLECTION",
    title: "Collection",
    plural: "Collections",
    glyph: "C",
    dir: "in",
    prefix: "COL",
    sub: "Money received from a client.",
    note: "Net Received is computed by the ledger: Bill Amount minus EWT.",
    amountField: "billAmount",
    required: ["date", "particulars", "project", "billAmount", "paymentMethod", "depositedTo"],
    money: ["billAmount", "ewt"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "billAmount", label: "Bill Amount", type: "money", required: true, half: true },
      { key: "particulars", label: "Particulars", type: "text", required: true, placeholder: "Downpayment, 2nd billing" },
      { key: "project", label: "Project", type: "select", required: true, list: "projects", half: true },
      { key: "ewt", label: "EWT Deducted", type: "money", half: true },
      { key: "paymentMethod", label: "Payment Method", type: "select", required: true, list: "paymentMethods", half: true },
      { key: "chequeRef", label: "Cheque / Ref No.", type: "text", half: true },
      { key: "depositedTo", label: "Deposited To", type: "select", required: true, list: "accounts" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
  },

  TRANSFERS: {
    key: "TRANSFERS",
    title: "Transfer",
    plural: "Transfers",
    glyph: "T",
    dir: "move",
    prefix: "TRF",
    sub: "Moving money between your own accounts.",
    amountField: "amount",
    required: ["date", "particulars", "fromAccount", "toAccount", "amount"],
    money: ["amount"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "amount", label: "Amount", type: "money", required: true, half: true },
      { key: "particulars", label: "Particulars", type: "text", required: true, placeholder: "Why the money was moved" },
      { key: "fromAccount", label: "From Account", type: "select", required: true, list: "accounts", half: true },
      { key: "toAccount", label: "To Account", type: "select", required: true, list: "accounts", half: true },
      { key: "reference", label: "Reference", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
};

/**
 * Atomic per-tenant, per-register, per-year counter. Replaces the sheet's
 * "scan for the first empty row" approach — a single INSERT .. ON CONFLICT
 * is race-safe under concurrent saves without needing a script lock.
 */
export async function nextEntryId(
  tx: Prisma.TransactionClient,
  tenantId: string,
  register: RegisterKey
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = REGISTERS[register].prefix;
  const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO "EntrySequence" ("tenantId", "register", "year", "lastNumber")
    VALUES (${tenantId}, ${register}, ${year}, 1)
    ON CONFLICT ("tenantId", "register", "year")
    DO UPDATE SET "lastNumber" = "EntrySequence"."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const n = rows[0].lastNumber;
  return `${prefix}-${year}-${String(n).padStart(6, "0")}`;
}
