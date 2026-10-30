// Property KPIs. Every ratio returns null on a zero/invalid denominator so
// the UI shows "—" instead of Infinity or NaN.

const ratio = (n: number, d: number) => (d > 0 && Number.isFinite(n / d) ? n / d : null);

export const noi = (grossIncome: number, operatingExpenses: number) => grossIncome - operatingExpenses;

/** NOI / value. Value is purchase price (yield on cost) or current value (market cap rate). */
export const capRate = (annualNoi: number, value: number) => ratio(annualNoi, value);

/** Annual pre-tax cash flow (after debt service) / cash invested. */
export const cashOnCash = (annualCashFlow: number, cashInvested: number) => ratio(annualCashFlow, cashInvested);

/** Gross rent multiplier: price / annual gross rent. */
export const grm = (price: number, annualGrossRent: number) => ratio(price, annualGrossRent);

/** Debt service coverage ratio: NOI / annual debt service. */
export const dscr = (annualNoi: number, annualDebtService: number) => ratio(annualNoi, annualDebtService);

export const ltv = (loanBalance: number, value: number) => ratio(loanBalance, value);

export const occupancy = (occupiedUnits: number, totalUnits: number) => ratio(occupiedUnits, totalUnits);

/** Highest price that still hits `targetCapRate` given stabilised NOI. */
export const maxOfferForCapRate = (annualNoi: number, targetCapRate: number) =>
  targetCapRate > 0 ? annualNoi / targetCapRate : null;

/** Sale proceeds after selling costs and loan payoff. */
export function netSaleProceeds(salePrice: number, sellingCostPct: number, loanPayoff: number) {
  return salePrice * (1 - sellingCostPct) - loanPayoff;
}
