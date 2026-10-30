import Link from "next/link";
import { notFound } from "next/navigation";
import { guard } from "../guard";
import Flash from "../Flash";
import {
  addUnitAction, changeStageAction, postTxnAction, setStakesAction, voidEntryAction,
} from "../actions";
import { db } from "@/lib/db";
import { getPropertyReport, TXN_KINDS } from "@/lib/realestate";
import { formatMoney } from "@/lib/finance/money";
import { allowedTransitions, PHASE_OF, STAGE_LABEL, type Stage } from "@/lib/finance/lifecycle";
import { capRate as capRateOf, occupancy } from "@/lib/finance/metrics";
import { dmy, pct, todayIso } from "@/lib/format";

export default async function PropertyPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ err?: string; ok?: string; from?: string; to?: string }>;
}) {
  const { tenant: slug, id } = await params;
  const sp = await searchParams;
  const { tenant, session, canManage } = await guard(slug);

  const p = await db.realProperty.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      units: { orderBy: { label: "asc" }, include: { leases: { where: { endedAt: null } } } },
      stageEvents: { orderBy: { at: "desc" }, take: 10 },
      stakes: { include: { investor: true } },
    },
  });
  if (!p) notFound();

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const year = new Date().getUTCFullYear();
  const from = sp.from && iso.test(sp.from) ? sp.from : `${year}-01-01`;
  const to = sp.to && iso.test(sp.to) ? sp.to : todayIso();
  const fromD = new Date(`${from}T00:00:00Z`);
  const toD = new Date(`${to}T23:59:59Z`);

  const [report, entries] = await Promise.all([
    getPropertyReport(tenant.id, p.id, fromD, toD),
    db.journalEntry.findMany({
      where: { tenantId: tenant.id, propertyId: p.id },
      orderBy: [{ date: "desc" }, { at: "desc" }], take: 30, include: { lines: { include: { account: true } } },
    }),
  ]);

  const cur = p.currency;
  const m = (v: number | null | undefined) => formatMoney(Number(v ?? 0), cur);
  const stage = p.stage as Stage;
  const next = allowedTransitions(stage);
  const days = Math.max((toD.getTime() - fromD.getTime()) / 86_400_000, 1);
  const cost = p.purchasePrice ? Number(p.purchasePrice) + Number(p.closingCosts) : 0;
  const yieldOnCost = capRateOf((report.pl.netIncome / days) * 365, cost);
  const marketCap = capRateOf((report.pl.netIncome / days) * 365, Number(p.currentValue ?? p.purchasePrice ?? 0));
  const occupied = p.units.filter((u) => u.leases.length).length;
  const rentRoll = p.units.reduce((s, u) => s + u.leases.reduce((a, l) => a + Number(l.monthlyRent), 0), 0);
  const stakeTotal = p.stakes.reduce((s, x) => s + Number(x.percent), 0);
  const bookable = stage !== "SOLD";

  return (
    <>
      <Flash err={sp.err} ok={sp.ok} />
      <div className="pagehd">
        <div>
          <h1>{p.name}</h1>
          <div className="sub">
            {[p.address, p.city, p.country].filter(Boolean).join(", ") || "No address"} · {cur} ·{" "}
            <span className="tag hold">{PHASE_OF[stage]}</span> <span className="tag go">{STAGE_LABEL[stage]}</span>
          </div>
        </div>
        <div className="tools"><Link href={`/t/${slug}/properties`} className="btn ghost" style={{ width: "auto", padding: "9px 16px" }}>← Portfolio</Link></div>
      </div>

      <div className="rack">
        <div className="k"><div className="top"><span className="lab">Purchase price</span></div><div className="v">{p.purchasePrice ? m(Number(p.purchasePrice)) : "—"}</div><div className="sub">+ {m(Number(p.closingCosts))} closing</div></div>
        <div className="k"><div className="top"><span className="lab">Market value</span></div><div className="v">{p.currentValue ? m(Number(p.currentValue)) : "—"}</div><div className="sub">cap rate {marketCap === null ? "—" : pct(marketCap)}</div></div>
        <div className="k"><div className="top"><span className="lab">Net income</span></div><div className="v" style={{ color: report.pl.netIncome < 0 ? "var(--out)" : undefined }}>{m(report.pl.netIncome)}</div><div className="sub">yield on cost {yieldOnCost === null ? "—" : pct(yieldOnCost)}</div></div>
        <div className="k"><div className="top"><span className="lab">Net cash flow</span></div><div className="v" style={{ color: report.cash.net < 0 ? "var(--out)" : undefined }}>{m(report.cash.net)}</div><div className="sub">in {m(report.cash.inflows)} · out {m(report.cash.outflows)}</div></div>
        <div className="k"><div className="top"><span className="lab">Rent roll / mo</span></div><div className="v">{m(rentRoll)}</div><div className="sub">occupancy {p.units.length ? pct(occupancy(occupied, p.units.length) ?? 0) : "—"}</div></div>
      </div>

      <div className="sheet" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Statements</h2>
          <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" name="from" defaultValue={from} /> <span>→</span> <input type="date" name="to" defaultValue={to} />
            <button className="btn ghost" style={{ width: "auto", padding: "7px 14px", margin: 0 }}>Apply</button>
          </form>
        </div>
        <div className="bd flush">
          <table>
            <thead><tr><th colSpan={2}>Profit &amp; Loss ({cur})</th></tr></thead>
            <tbody>
              {report.pl.income.map((r) => <tr key={r.code}><td>{r.code} {r.name}</td><td style={{ textAlign: "right" }}>{m(r.amount)}</td></tr>)}
              <tr><td><b>Total income</b></td><td style={{ textAlign: "right" }}><b>{m(report.pl.totalIncome)}</b></td></tr>
              {report.pl.expenses.map((r) => <tr key={r.code}><td>{r.code} {r.name}</td><td style={{ textAlign: "right" }}>{m(r.amount)}</td></tr>)}
              <tr><td><b>Total expenses</b></td><td style={{ textAlign: "right" }}><b>{m(report.pl.totalExpenses)}</b></td></tr>
              <tr><td><b>Net income</b></td><td style={{ textAlign: "right" }}><b>{m(report.pl.netIncome)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Lifecycle</h2></div>
        <div className="bd">
          {canManage && next.length > 0 ? (
            <form action={changeStageAction.bind(null, slug, p.id)}>
              <div className="grid2">
                <div className="field"><label htmlFor="to">Move to</label>
                  <select id="to" name="to">{next.map((s) => <option key={s} value={s}>{PHASE_OF[s]} · {STAGE_LABEL[s]}</option>)}</select></div>
                <div className="field money"><label htmlFor="salePrice">Sale price (if Sold)</label><input id="salePrice" name="salePrice" inputMode="decimal" /></div>
              </div>
              <div className="field"><label htmlFor="note">Note</label><input id="note" name="note" /></div>
              <button className="btn" type="submit">Update stage</button>
            </form>
          ) : <div style={{ color: "var(--ink-2)" }}>{next.length ? "Only an Owner can change the stage." : "This property is sold — the lifecycle is complete."}</div>}
          <table style={{ marginTop: 16 }}><tbody>
            {p.stageEvents.map((e) => <tr key={e.id}><td>{dmy(e.at)}</td><td>{e.fromStage ? `${STAGE_LABEL[e.fromStage as Stage]} → ` : ""}{STAGE_LABEL[e.toStage as Stage]}</td><td>{e.byName}</td><td>{e.note}</td></tr>)}
          </tbody></table>
        </div>
      </div>

      {bookable && (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="hd"><h2>Post a transaction</h2></div>
          <div className="bd">
            <form action={postTxnAction.bind(null, slug, p.id)}>
              <div className="grid2">
                <div className="field"><label htmlFor="kind">Type</label>
                  <select id="kind" name="kind">{Object.entries(TXN_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                <div className="field"><label htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={todayIso()} required /></div>
                <div className="field money"><label htmlFor="amount">Amount ({cur})</label><input id="amount" name="amount" inputMode="decimal" required /></div>
                <div className="field"><label htmlFor="memo">Description</label><input id="memo" name="memo" required /></div>
              </div>
              {cur !== tenant.baseCurrency && <div className="hint">Needs an FX rate {cur} → {tenant.baseCurrency} on or before the date.</div>}
              <button className="btn" type="submit">Post</button>
            </form>
          </div>
        </div>
      )}

      <div className="sheet" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Journal</h2></div>
        <div className="bd flush">
          <table>
            <thead><tr><th>No.</th><th>Date</th><th>Description</th><th style={{ textAlign: "right" }}>Amount</th><th></th></tr></thead>
            <tbody>
              {entries.map((e) => {
                const amt = e.lines.reduce((s, l) => s + Number(l.debit), 0);
                return (
                  <tr key={e.id} style={e.voidedAt ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
                    <td>{e.entryNo}</td><td>{dmy(e.date)}</td><td>{e.memo}{e.voidedAt ? ` — VOID: ${e.voidReason}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{m(amt)}</td>
                    <td>{!e.voidedAt && session.perms.canVoid && (
                      <form action={voidEntryAction.bind(null, slug, p.id, e.id)} style={{ display: "flex", gap: 6 }}>
                        <input name="reason" placeholder="Reason" required style={{ width: 140 }} />
                        <button className="btn ghost" style={{ width: "auto", padding: "5px 10px", margin: 0 }}>Void</button>
                      </form>
                    )}</td>
                  </tr>
                );
              })}
              {!entries.length && <tr><td colSpan={5} style={{ color: "var(--ink-2)" }}>No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 18 }}>
        <div className="hd"><h2>Rent roll</h2></div>
        <div className="bd flush">
          <table>
            <thead><tr><th>Unit</th><th>Tenant</th><th>Rent / mo</th><th>Market rent</th><th>Lease ends</th></tr></thead>
            <tbody>
              {p.units.map((u) => {
                const l = u.leases[0];
                return <tr key={u.id}><td>{u.label}</td><td>{l ? l.tenantName : <span className="tag void">Vacant</span>}</td><td>{l ? m(Number(l.monthlyRent)) : "—"}</td><td>{m(Number(u.marketRent))}</td><td>{l?.endDate ? dmy(l.endDate) : "—"}</td></tr>;
              })}
              {!p.units.length && <tr><td colSpan={5} style={{ color: "var(--ink-2)" }}>No units yet.</td></tr>}
            </tbody>
          </table>
        </div>
        {canManage && (
          <div className="bd">
            <form action={addUnitAction.bind(null, slug, p.id)}>
              <div className="grid2">
                <div className="field"><label className="req" htmlFor="label">Unit</label><input id="label" name="label" required /></div>
                <div className="field money"><label htmlFor="marketRent">Market rent / mo</label><input id="marketRent" name="marketRent" inputMode="decimal" /></div>
                <div className="field"><label htmlFor="tenantName">Tenant (leave blank if vacant)</label><input id="tenantName" name="tenantName" /></div>
                <div className="field money"><label htmlFor="monthlyRent">Lease rent / mo</label><input id="monthlyRent" name="monthlyRent" inputMode="decimal" /></div>
                <div className="field money"><label htmlFor="deposit">Deposit</label><input id="deposit" name="deposit" inputMode="decimal" /></div>
                <div className="field"><label htmlFor="startDate">Lease start</label><input id="startDate" name="startDate" type="date" /></div>
                <div className="field"><label htmlFor="endDate">Lease end</label><input id="endDate" name="endDate" type="date" /></div>
              </div>
              <button className="btn" type="submit">Add unit</button>
            </form>
          </div>
        )}
      </div>

      {tenant.investorMode === "SYNDICATION" && (
        <div className="sheet" style={{ marginTop: 18 }}>
          <div className="hd"><h2>Investor stakes</h2><span className="tag hold">{stakeTotal}% allocated</span></div>
          <div className="bd">
            {canManage ? (
              <form action={setStakesAction.bind(null, slug, p.id)}>
                {[...p.stakes.map((s) => ({ n: s.investor.name, v: String(Number(s.percent)) })), { n: "", v: "" }, { n: "", v: "" }].map((r, i) => (
                  <div className="grid2" key={i}>
                    <div className="field"><input name="investor" defaultValue={r.n} placeholder="Investor name" /></div>
                    <div className="field"><input name="percent" defaultValue={r.v} placeholder="%" inputMode="decimal" /></div>
                  </div>
                ))}
                <div className="hint">Saving replaces the current split. Must total exactly 100%.</div>
                <button className="btn" type="submit">Save stakes</button>
              </form>
            ) : p.stakes.map((s) => <div key={s.investorId}>{s.investor.name} — {Number(s.percent)}%</div>)}
          </div>
        </div>
      )}
    </>
  );
}
