// Investment return math: NPV, IRR (periodic and dated), equity multiple.

export function npv(rate: number, flows: number[]): number {
  return flows.reduce((s, cf, i) => s + cf / (1 + rate) ** i, 0);
}

function hasSignChange(flows: number[]) {
  return flows.some((f) => f > 0) && flows.some((f) => f < 0);
}

/** Bisection on [-0.99, 10]; robust where Newton diverges. Null if no root. */
function solve(f: (r: number) => number): number | null {
  let lo = -0.99;
  let hi = 10;
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-9 || hi - lo < 1e-12) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

/** IRR per period for evenly spaced flows (flows[0] is usually the purchase, negative). */
export function irr(flows: number[]): number | null {
  if (!hasSignChange(flows)) return null;
  return solve((r) => npv(r, flows));
}

export type DatedFlow = { date: Date; amount: number };

/** Annualised IRR for irregular dated flows (Excel XIRR convention, 365-day year). */
export function xirr(flows: DatedFlow[]): number | null {
  if (flows.length < 2 || !hasSignChange(flows.map((f) => f.amount))) return null;
  const t0 = Math.min(...flows.map((f) => f.date.getTime()));
  const f = (r: number) =>
    flows.reduce((s, cf) => s + cf.amount / (1 + r) ** ((cf.date.getTime() - t0) / 86_400_000 / 365), 0);
  return solve(f);
}

/** Total cash returned divided by total cash invested. Null if nothing invested. */
export function equityMultiple(flows: number[]): number | null {
  const invested = -flows.filter((f) => f < 0).reduce((s, f) => s + f, 0);
  if (invested <= 0) return null;
  return flows.filter((f) => f > 0).reduce((s, f) => s + f, 0) / invested;
}
