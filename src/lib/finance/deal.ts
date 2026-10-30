import { balanceAfter, paymentFor } from "./amortization";
import { capRate, cashOnCash, dscr, grm, maxOfferForCapRate } from "./metrics";
import { equityMultiple, irr } from "./returns";
import { round } from "./money";

// Percent inputs are fractions (0.05 = 5%).
export type DealInput = {
  price: number;
  closingCostPct: number;
  downPaymentPct: number;
  interestRate: number;
  loanYears: number;
  monthlyRent: number;
  vacancyPct: number;
  /** Operating expenses as a share of effective gross income (excludes debt service). */
  opexPct: number;
  annualRentGrowth: number;
  annualAppreciation: number;
  holdYears: number;
  sellingCostPct: number;
  targetCapRate: number;
};

export type YearRow = { year: number; noi: number; debtService: number; cashFlow: number; loanBalance: number; propertyValue: number; saleProceeds: number };

export type DealResult = {
  loanAmount: number;
  cashInvested: number;
  monthlyPayment: number;
  grossAnnualRent: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  annualDebtService: number;
  annualCashFlow: number;
  capRate: number | null;
  cashOnCash: number | null;
  grm: number | null;
  dscr: number | null;
  maxOffer: number | null;
  years: YearRow[];
  flows: number[];
  irr: number | null;
  equityMultiple: number | null;
};

const frac = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;

export function validateDeal(i: DealInput): string | null {
  if (!(i.price > 0)) return "Purchase price must be greater than zero.";
  if (!(i.monthlyRent >= 0) || !Number.isFinite(i.monthlyRent)) return "Monthly rent cannot be negative.";
  for (const [label, v] of [
    ["Closing costs", i.closingCostPct], ["Down payment", i.downPaymentPct], ["Vacancy", i.vacancyPct],
    ["Operating expenses", i.opexPct], ["Selling costs", i.sellingCostPct],
  ] as const) if (!frac(v)) return `${label} must be between 0% and 100%.`;
  if (!(i.interestRate >= 0 && i.interestRate < 1)) return "Interest rate must be between 0% and 100%.";
  if (!(i.loanYears > 0 && i.loanYears <= 50)) return "Loan term must be between 1 and 50 years.";
  if (!(Number.isInteger(i.holdYears) && i.holdYears >= 1 && i.holdYears <= 50)) return "Hold period must be a whole number of years (1–50).";
  if (!(i.targetCapRate >= 0 && i.targetCapRate < 1)) return "Target cap rate must be between 0% and 100%.";
  if (!Number.isFinite(i.annualRentGrowth) || !Number.isFinite(i.annualAppreciation)) return "Growth rates must be numbers.";
  return null;
}

/** Year-by-year projection with a sale at the end of the hold period. */
export function analyzeDeal(i: DealInput): DealResult {
  const down = i.price * i.downPaymentPct;
  const loanAmount = i.price - down;
  const closing = i.price * i.closingCostPct;
  const cashInvested = down + closing;
  const terms = { principal: loanAmount, annualRate: i.interestRate, years: i.loanYears };
  const pmt = loanAmount > 0 ? paymentFor(terms) : 0;
  const annualDebtService = pmt * 12;

  const years: YearRow[] = [];
  for (let y = 1; y <= i.holdYears; y++) {
    const gross = i.monthlyRent * 12 * (1 + i.annualRentGrowth) ** (y - 1);
    const egi = gross * (1 - i.vacancyPct);
    const noi = egi * (1 - i.opexPct);
    // Debt service stops once the loan is paid off inside the hold period.
    const ds = y <= i.loanYears ? annualDebtService : 0;
    const bal = loanAmount > 0 ? balanceAfter(terms, Math.min(y * 12, Math.round(i.loanYears * 12))) : 0;
    const value = i.price * (1 + i.annualAppreciation) ** y;
    const sale = y === i.holdYears ? value * (1 - i.sellingCostPct) - bal : 0;
    years.push({ year: y, noi: round(noi), debtService: round(ds), cashFlow: round(noi - ds), loanBalance: round(bal), propertyValue: round(value), saleProceeds: round(sale) });
  }

  const flows = [-cashInvested, ...years.map((r) => r.cashFlow + r.saleProceeds)].map((f) => round(f));
  const gross1 = i.monthlyRent * 12;
  const egi1 = gross1 * (1 - i.vacancyPct);
  const noi1 = egi1 * (1 - i.opexPct);
  const cf1 = noi1 - annualDebtService;

  return {
    loanAmount: round(loanAmount), cashInvested: round(cashInvested), monthlyPayment: round(pmt),
    grossAnnualRent: round(gross1), effectiveGrossIncome: round(egi1), operatingExpenses: round(egi1 - noi1),
    noi: round(noi1), annualDebtService: round(annualDebtService), annualCashFlow: round(cf1),
    capRate: capRate(noi1, i.price), cashOnCash: cashOnCash(cf1, cashInvested), grm: grm(i.price, gross1),
    dscr: annualDebtService > 0 ? dscr(noi1, annualDebtService) : null,
    maxOffer: maxOfferForCapRate(noi1, i.targetCapRate),
    years, flows, irr: irr(flows), equityMultiple: equityMultiple(flows),
  };
}
