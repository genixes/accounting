"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { peso, pct } from "@/lib/format";

type Slice = { name: string; amount: number };

function TooltipBox({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div style={{ background: "#16203A", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px", boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#F4F6FB" }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: p.payload.fill, flex: "none" }} />
        <span style={{ color: "#9AA6C3" }}>{p.name}</span>
        <span style={{ marginLeft: "auto", fontWeight: 600 }}>{peso(p.value)}</span>
      </div>
    </div>
  );
}

export default function CategoryDonut({ data, colors }: { data: Slice[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 190, height: 190, flex: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} strokeWidth={2} stroke="#111A2E">
              {data.map((d, i) => <Cell key={d.name} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip content={<TooltipBox />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontFamily: "var(--data)", fontSize: 15, fontWeight: 700, color: "#fff" }}>{peso(total).replace(".00", "")}</div>
          <div style={{ fontSize: 10, color: "#6B7797", textTransform: "uppercase", letterSpacing: ".08em", marginTop: 2 }}>Total</div>
        </div>
      </div>
      <div className="legend-list" style={{ flex: 1, minWidth: 180 }}>
        {data.map((d, i) => (
          <div className="row" key={d.name}>
            <span className="dot" style={{ background: colors[i % colors.length] }} />
            <span className="t">{d.name}</span>
            <span className="amt">{peso(d.amount)}</span>
            <span className="pct">{pct(total ? d.amount / total : 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
