// Pure money helpers. Amounts are plain numbers rounded to the currency's
// minor unit at every boundary; Postgres stores them as Decimal.

export type CurrencyInfo = { code: string; name: string; symbol: string; decimals: number };

export const CURRENCIES: CurrencyInfo[] = [
  { code: "PHP", name: "Philippine Peso", symbol: "₱", decimals: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimals: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED ", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", decimals: 0 },
  { code: "KRW", name: "South Korean Won", symbol: "₩", decimals: 0 },
  { code: "THB", name: "Thai Baht", symbol: "฿", decimals: 2 },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp ", decimals: 0 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM ", decimals: 2 },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", decimals: 0 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", decimals: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "CN¥", decimals: 2 },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimals: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimals: 2 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF ", decimals: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimals: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimals: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R ", decimals: 2 },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function isCurrency(code: string): boolean {
  return BY_CODE.has(code);
}

export function currencyInfo(code: string): CurrencyInfo {
  return BY_CODE.get(code) ?? { code, name: code, symbol: `${code} `, decimals: 2 };
}

/** Round half away from zero at `decimals` places, without the 1.005 float trap. */
export function round(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** decimals;
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Number((Math.abs(n) * f).toPrecision(15)))) / f;
}

export function roundMoney(n: number, currency: string): number {
  return round(n, currencyInfo(currency).decimals);
}

export function formatMoney(n: number, currency: string, opts?: { compact?: boolean }): string {
  const info = currencyInfo(currency);
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (opts?.compact) {
    const t = a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : a.toFixed(0);
    return `${sign}${info.symbol}${t}`;
  }
  const body = a.toLocaleString("en-US", { minimumFractionDigits: info.decimals, maximumFractionDigits: info.decimals });
  return `${sign}${info.symbol}${body}`;
}
