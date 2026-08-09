export function peso(v: number, signIfNegative?: boolean): string {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const body = a.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = signIfNegative && n < 0 ? "-₱" : "₱";
  return `${cur}${body}`;
}

export function pesoShort(v: number): string {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const t = a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}k` : a.toFixed(0);
  return `₱${t}`;
}

export function pct(v: number): string {
  return `${((Number(v) || 0) * 100).toFixed(1)}%`;
}

export function dmy(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
