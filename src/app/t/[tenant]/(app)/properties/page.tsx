import Link from "next/link";
import { guard } from "./guard";
import Flash from "./Flash";
import { getPortfolio } from "@/lib/realestate";
import { getAlerts } from "@/lib/documents";
import { formatMoney } from "@/lib/finance/money";
import { PHASE_OF, STAGE_LABEL, type Stage } from "@/lib/finance/lifecycle";
import { dmy, pct } from "@/lib/format";

export default async function PortfolioPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await guard(slug);
  const base = tenant.baseCurrency;
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const [{ rows, totals }, alerts] = await Promise.all([getPortfolio(tenant.id, base, yearStart), getAlerts(tenant.id)]);
  const dash = (v: string | null) => v ?? "—";
  const phases = ["BUY", "RENT", "HOLD", "SELL"] as const;

  return (
    <>
      <Flash err={sp.err} ok={sp.ok} />
      <div className="pagehd">
        <div>
          <h1>Portfolio</h1>
          <div className="sub">
            {tenant.investorMode === "SYNDICATION" ? "Syndication" : "Solo investor"} · reporting in {base} · year to date
          </div>
        </div>
        <div className="tools">
          <Link href={`/t/${slug}/properties/fx`} className="btn ghost" style={{ width: "auto", padding: "9px 16px" }}>FX rates</Link>
          {canManage && <Link href={`/t/${slug}/properties/new`} className="btn" style={{ width: "auto", padding: "9px 16px" }}>+ Add property</Link>}
        </div>
      </div>

      {totals.fxMissing && (
        <Flash err={`Some properties are in a currency with no FX rate to ${base}; they are excluded from totals. Add rates under FX rates.`} />
      )}

      <div className="rack">
        <div className="k"><div className="top"><span className="lab">Portfolio value</span></div><div className="v">{formatMoney(totals.valueBase, base, { compact: true })}</div><div className="sub">owned properties</div></div>
        <div className="k"><div className="top"><span className="lab">NOI (YTD)</span></div><div className="v" style={{ color: totals.noiBase < 0 ? "var(--out)" : undefined }}>{formatMoney(totals.noiBase, base)}</div><div className="sub">income − operating expenses</div></div>
        <div className="k"><div className="top"><span className="lab">Monthly rent roll</span></div><div className="v">{formatMoney(totals.monthlyRentBase, base)}</div><div className="sub">active leases</div></div>
        <div className="k"><div className="top"><span className="lab">Occupancy</span></div><div className="v">{totals.occupancy === null ? "—" : pct(totals.occupancy)}</div><div className="sub">units with an active lease</div></div>
        <div className="k"><div className="top"><span className="lab">Properties</span></div><div className="v">{rows.length}</div><div className="sub">{phases.map((p) => `${rows.filter((r) => PHASE_OF[r.stage] === p).length} ${p.toLowerCase()}`).join(" · ")}</div></div>
      </div>

      {alerts.length > 0 && (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="hd"><h2>Needs attention</h2><span className={`tag ${alerts.some((a) => a.severity === "overdue") ? "void" : "hold"}`}>{alerts.length} item{alerts.length === 1 ? "" : "s"}</span></div>
          <div className="bd flush">
            <table><tbody>
              {alerts.slice(0, 12).map((a, i) => (
                <tr key={i}>
                  <td style={{ width: 96 }}><span className={`tag ${a.severity === "overdue" ? "void" : a.severity === "soon" ? "hold" : "go"}`}>{a.severity}</span></td>
                  <td><Link href={`/t/${slug}/properties/${a.propertyId}`}><b>{a.title}</b></Link><div className="sub">{a.propertyName}</div></td>
                  <td>{a.detail}</td>
                  <td>{a.date ? dmy(a.date) : ""}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}

      <div className="sheet" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Properties</h2></div>
        <div className="bd flush">
          {rows.length === 0 ? (
            <div style={{ padding: 22, color: "var(--ink-2)" }}>No properties yet.{canManage ? " Add your first one to start tracking BUY → RENT → HOLD → SELL." : ""}</div>
          ) : (
            <table>
              <thead><tr><th>Property</th><th>Phase</th><th>Stage</th><th>Value ({base})</th><th>NOI YTD ({base})</th><th>Cap rate</th><th>Occupancy</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/t/${slug}/properties/${r.id}`}><b>{r.name}</b></Link><div className="sub">{[r.city, r.currency].filter(Boolean).join(" · ")}</div></td>
                    <td>{PHASE_OF[r.stage as Stage]}</td>
                    <td><span className={`tag ${r.stage === "SOLD" ? "void" : r.stage === "LEASED" ? "go" : "hold"}`}>{STAGE_LABEL[r.stage as Stage]}</span></td>
                    <td>{dash(r.valueBase === null ? null : formatMoney(r.valueBase, base, { compact: true }))}</td>
                    <td>{formatMoney(r.noiBase, base)}</td>
                    <td>{dash(r.capRate === null ? null : pct(r.capRate))}</td>
                    <td>{r.unitCount ? `${r.occupiedUnits}/${r.unitCount}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
