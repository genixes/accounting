import { round } from "./money";

export type LoanTerms = { principal: number; annualRate: number; years: number; paymentsPerYear?: number };
export type ScheduleRow = { n: number; payment: number; interest: number; principal: number; balance: number };

/** Level payment for a fully amortising loan. Handles 0% interest. */
export function paymentFor({ principal, annualRate, years, paymentsPerYear = 12 }: LoanTerms): number {
  const n = Math.round(years * paymentsPerYear);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / paymentsPerYear;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

export function schedule(terms: LoanTerms): ScheduleRow[] {
  const { principal, annualRate, years, paymentsPerYear = 12 } = terms;
  const n = Math.round(years * paymentsPerYear);
  const r = annualRate / paymentsPerYear;
  const pmt = round(paymentFor(terms));
  const rows: ScheduleRow[] = [];
  let bal = principal;
  for (let i = 1; i <= n; i++) {
    const interest = round(bal * r);
    // The last payment clears the residual so rounding never leaves a stub balance.
    const pay = i === n ? round(bal + interest) : pmt;
    const princ = round(pay - interest);
    bal = round(bal - princ);
    rows.push({ n: i, payment: pay, interest, principal: princ, balance: i === n ? 0 : bal });
  }
  return rows;
}

/** Remaining balance after `paid` payments. */
export function balanceAfter(terms: LoanTerms, paid: number): number {
  const rows = schedule(terms);
  if (paid <= 0) return round(terms.principal);
  if (paid >= rows.length) return 0;
  return rows[paid - 1].balance;
}

/** Whole payments that have fallen due between `start` and `asOf`, capped at the loan's term. */
export function paymentsElapsed(start: Date, asOf: Date, termYears: number, paymentsPerYear = 12): number {
  let months = (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - start.getUTCMonth());
  if (asOf.getUTCDate() < start.getUTCDate()) months -= 1;
  const n = Math.floor((Math.max(months, 0) * paymentsPerYear) / 12);
  return Math.min(n, Math.round(termYears * paymentsPerYear));
}

/** Principal vs interest totals per loan year, for charting. */
export function yearlySummary(terms: LoanTerms): { year: number; principal: number; interest: number; balance: number }[] {
  const per = terms.paymentsPerYear ?? 12;
  const out: { year: number; principal: number; interest: number; balance: number }[] = [];
  for (const r of schedule(terms)) {
    const y = Math.ceil(r.n / per);
    const row = out[y - 1] ?? (out[y - 1] = { year: y, principal: 0, interest: 0, balance: 0 });
    row.principal = round(row.principal + r.principal);
    row.interest = round(row.interest + r.interest);
    row.balance = r.balance;
  }
  return out;
}
