"use client";

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { pesoShort, peso } from "@/lib/format";

type Point = { month: string; in: number; out: number; net: number };

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#04284D", border: "1px solid rgba(158,194,205,.16)", borderRadius: 10, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ fontSize: 11, color: "#62899A", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#F2F7F9", padding: "2px 0" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flex: "none" }} />
          <span style={{ color: "#9EC2CD" }}>{p.name}</span>
          <span style={{ marginLeft: "auto", fontWeight: 600 }}>{peso(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CashFlowChart({ data, inColor, outColor, netColor }: { data: Point[]; inColor: string; outColor: string; netColor: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "#62899A", fontSize: 12 }} axisLine={{ stroke: "rgba(158,194,205,.10)" }} tickLine={false} />
        <YAxis tick={{ fill: "#62899A", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => pesoShort(v)} width={54} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "rgba(255,255,255,.03)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "#9EC2CD" }}
          formatter={(value: string) => <span style={{ color: "#9EC2CD" }}>{value}</span>}
        />
        <Bar dataKey="in" name="Cash Inflow" fill={inColor} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="out" name="Cash Outflow" fill={outColor} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line dataKey="net" name="Net Cash Flow" stroke={netColor} strokeWidth={2} dot={{ r: 3, fill: netColor, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
