import { round } from "./money";

/** Rates are stored as "1 `from` = `rate` `to`". */
export type FxQuote = { from: string; to: string; rate: number; asOf: Date };

/**
 * Picks the most recent rate on or before `asOf`, trying direct, then
 * inverse, then a USD-style pivot through `pivot`. Returns null if the
 * pair can't be resolved — callers must surface that, never assume 1.
 */
export function findRate(
  quotes: FxQuote[],
  from: string,
  to: string,
  asOf: Date,
  pivot = "USD"
): number | null {
  if (from === to) return 1;
  const latest = (a: string, b: string) => {
    let best: FxQuote | null = null;
    for (const q of quotes) {
      if (q.from === a && q.to === b && q.asOf <= asOf && (!best || q.asOf > best.asOf)) best = q;
    }
    return best;
  };
  const direct = latest(from, to);
  if (direct && direct.rate > 0) return direct.rate;
  const inverse = latest(to, from);
  if (inverse && inverse.rate > 0) return 1 / inverse.rate;
  if (from !== pivot && to !== pivot) {
    const a = findRate(quotes, from, pivot, asOf, pivot);
    const b = findRate(quotes, pivot, to, asOf, pivot);
    if (a !== null && b !== null) return a * b;
  }
  return null;
}

export function convert(amount: number, rate: number, decimals = 2): number {
  return round(amount * rate, decimals);
}
