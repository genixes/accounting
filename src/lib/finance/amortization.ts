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
