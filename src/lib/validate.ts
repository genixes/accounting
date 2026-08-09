import "server-only";
import { REGISTERS } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";
import type { Session } from "@/lib/auth";

export type Lists = {
  projects: string[];
  categories: string[];
  paymentMethods: string[];
  accounts: string[];
  suppliers: string[];
};

const LOOKUP_LIST: Record<string, keyof Lists> = {
  project: "projects",
  category: "categories",
  paidFrom: "accounts",
  supplier: "suppliers",
  paidBy: "accounts",
  paymentMethod: "paymentMethods",
  depositedTo: "accounts",
  fromAccount: "accounts",
  toAccount: "accounts",
};

export type ValidateResult = {
  errs: string[];
  clean: Record<string, unknown>;
};

/**
 * Ported from Code.gs validate_(). Same rules: required fields, non-negative
 * money, dropdown values must exist in their list, a Foreman can only file
 * against an assigned project, EWT can't exceed the bill, transfer accounts
 * must differ.
 */
export function validateEntry(
  regKey: RegisterKey,
  payload: Record<string, unknown>,
  session: Session,
  lists: Lists
): ValidateResult {
  const cfg = REGISTERS[regKey];
  const errs: string[] = [];
  const clean: Record<string, unknown> = {};

  for (const f of cfg.required) {
    const v = payload[f];
    if (v === undefined || v === null || String(v).trim() === "") {
      errs.push(`${f} is required.`);
    }
  }

  for (const f of cfg.money) {
    const v = payload[f];
    if (v === undefined || v === null || String(v).trim() === "") {
      clean[f] = 0;
      continue;
    }
    const n = Number(String(v).replace(/,/g, ""));
    if (isNaN(n)) {
      errs.push(`${f} must be a number.`);
      continue;
    }
    if (n < 0) {
      errs.push(`${f} cannot be negative.`);
      continue;
    }
    clean[f] = n;
  }
  for (const f of cfg.required) {
    if (cfg.money.includes(f) && clean[f] === 0) {
      errs.push(`${f} must be greater than zero.`);
    }
  }

  for (const field of Object.keys(LOOKUP_LIST)) {
    const v = payload[field];
    if (!v) continue;
    if (!cfg.fields.some((fd) => fd.key === field)) continue;
    const listName = LOOKUP_LIST[field];
    if (!lists[listName].includes(String(v).trim())) {
      errs.push(`"${v}" is not in the ${listName} list.`);
    }
  }

  if (session.perms.projectLimited && payload.project) {
    if (!session.projects.includes(String(payload.project).trim())) {
      errs.push(`You are not assigned to project "${payload.project}".`);
    }
  }

  if (regKey === "TRANSFERS" && payload.fromAccount && payload.fromAccount === payload.toAccount) {
    errs.push("From and To cannot be the same account.");
  }

  if (regKey === "COLLECTION" && Number(clean.ewt) > Number(clean.billAmount)) {
    errs.push("EWT cannot be more than the bill amount.");
  }

  for (const f of ["date", "payDate"]) {
    if (payload[f]) {
      const d = new Date(String(payload[f]));
      if (isNaN(d.getTime())) errs.push(`${f} is not a valid date.`);
      else clean[f] = d;
    }
  }

  return { errs, clean };
}
