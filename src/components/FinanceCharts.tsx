"use client";

import {
  Area, AreaChart, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMoney } from "@/lib/finance/money";

// Chart chrome reads the theme tokens so it works in light and dark.
const AXIS = { fill: "var(--ink-3)", fontSize: 12 };
const GRID = "var(--rule)";

type TipProps = { active?: boolean; payload?: readonly { name?: unknown; value?: unknown; color?: string }[]; label?: string | number };

function GlassTip({ currency, prefix }: { currency: string; prefix?: string }) {
  return function Tip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="chart-tip">
        <div className="tl">{prefix}{label}</div>
        {payload.map((p) => (
          <div key={String(p.name)} className="row">
            <span className="dot" style={{ background: p.color }} />
            <span className="nm">{String(p.name)}</span>
            <b>{formatMoney(Number(p.value), currency)}</b>
          </div>
        ))}
      </div>
    );
  };
}

export type ProjectionPoint = { year: number; cashFlow: number; saleProceeds: number; loanBalance: number };

export function ProjectionChart({ data, currency }: { data: ProjectionPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="gSale" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity={0.95} />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `Y${v}`} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
        <Tooltip content={GlassTip({ currency, prefix: "Year " })} cursor={{ fill: "var(--rule-soft)" }} />
        <Legend formatter={(v: string) => <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{v}</span>} />
        <Bar dataKey="cashFlow" name="Cash flow" stackId="a" fill="url(#gCash)" radius={[8, 8, 0, 0]} maxBarSize={34} />
        <Bar dataKey="saleProceeds" name="Sale proceeds" stackId="a" fill="url(#gSale)" radius={[8, 8, 0, 0]} maxBarSize={34} />
        <Line dataKey="loanBalance" name="Loan balance" stroke="var(--hold)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type AmortPoint = { year: number; principal: number; interest: number };

export function AmortChart({ data, currency }: { data: AmortPoint[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
        <defs>
          <linearGradient id="gPrin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.7} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gInt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--out)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="var(--out)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `Y${v}`} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => formatMoney(v, currency, { compact: true })} />
        <Tooltip content={GlassTip({ currency, prefix: "Loan year " })} />
        <Legend formatter={(v: string) => <span style={{ color: "var(--ink-2)", fontSize: 12 }}>{v}</span>} />
        <Area type="monotone" dataKey="principal" name="Principal" stackId="1" stroke="var(--accent)" strokeWidth={2} fill="url(#gPrin)" />
        <Area type="monotone" dataKey="interest" name="Interest" stackId="1" stroke="var(--out)" strokeWidth={2} fill="url(#gInt)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
