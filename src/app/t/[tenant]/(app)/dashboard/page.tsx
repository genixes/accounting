import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, Wallet, BarChart3, Landmark, CreditCard, FileBarChart2, Building2 } from "lucide-react";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { getDashboard, getCashFlowSeries, defaultRange, type DashboardRange } from "@/lib/dashboard";
import { peso, pct, dmy } from "@/lib/format";
import { REGISTER_ICON } from "@/components/register-icons";
import CashFlowChart from "@/components/CashFlowChart";
import CategoryDonut from "@/components/CategoryDonut";

// Fixed, validated-for-dark categorical order — independent of tenant accent,
// since expense categories are data identity, not brand identity.
const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9", "#e66767", "#008300"];

const PRESETS: { key: string; label: string; days: number | null }[] = [
  { key: "30", label: "30 Days", days: 30 },
  { key: "90", label: "90 Days", days: 90 },
  { key: "365", label: "12 Months", days: 365 },
];

function rangeForPreset(key: string | undefined): DashboardRange {
  const preset = PRESETS.find((p) => p.key === key);
  if (!preset) return defaultRange();
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (preset.days! - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

/** `invert` is for metrics where a decrease is the good outcome (expenses):
 *  the arrow always shows the real direction of change, only the color's
 *  sentiment flips. */
function Delta({ change, invert }: { change: number | null; invert?: boolean }) {
  if (change === null) return <span className="sub">no prior data to compare</span>;
  const increased = change >= 0;
  const good = invert ? !increased : increased;
  return (
    <div className="sub">
      <span className={`delta ${good ? "up" : "down"}`}>{increased ? "↑" : "↓"} {pct(Math.abs(change))}</span>
      <span>vs previous period</span>
    </div>
  );
}

export default async function DashboardPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.seeAllEntries) redirect(`/t/${slug}/ledger`);

  const activePreset = sp.range && PRESETS.some((p) => p.key === sp.range) ? sp.range : "90";
  const range = rangeForPreset(activePreset);

  const [d, cashFlow] = await Promise.all([
    getDashboard(tenant.id, session, range),
    getCashFlowSeries(tenant.id, 6),
  ]);

  const topCats = d.categories.slice(0, 8);
  const base = `/t/${slug}/dashboard`;

  return (
    <>
      <div className="pagehd">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Overview of your construction business performance</div>
        </div>
        <div className="tools">
          <div style={{ display: "flex", gap: 6, background: "var(--sheet)", border: "1px solid var(--rule)", borderRadius: 10, padding: 4 }}>
            {PRESETS.map((p) => (
              <Link key={p.key} href={`${base}?range=${p.key}`}
                className="btn ghost" style={{
                  width: "auto", padding: "7px 13px", fontSize: 11, margin: 0,
                  ...(activePreset === p.key ? { background: "var(--accent)", color: "#04121a", border: "1px solid transparent" } : { border: "1px solid transparent" }),
                }}>
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="rack">
        <div className="k">
          <div className="top">
            <span className="lab">Revenue</span>
            <span className="icon ic-aqua"><TrendingUp /></span>
          </div>
          <div className="v">{peso(d.kpi.revenue.value)}</div>
          <Delta change={d.kpi.revenue.change} />
        </div>
        <div className="k">
          <div className="top">
            <span className="lab">Total Expenses</span>
            <span className="icon ic-orange"><Wallet /></span>
          </div>
          <div className="v">{peso(d.kpi.expenses.value)}</div>
          <Delta change={d.kpi.expenses.change} invert />
        </div>
        <div className="k">
          <div className="top">
            <span className="lab">Net Income</span>
            <span className="icon ic-blue"><BarChart3 /></span>
          </div>
          <div className="v" style={{ color: d.kpi.netIncome.value < 0 ? "var(--out)" : undefined }}>{peso(d.kpi.netIncome.value, true)}</div>
          <Delta change={d.kpi.netIncome.change} />
        </div>
        <div className="k">
          <div className="top">
            <span className="lab">Receivable</span>
            <span className="icon ic-yellow"><Landmark /></span>
          </div>
          <div className="v" style={{ color: d.kpi.receivable.value > 0 ? "var(--out)" : undefined }}>{peso(d.kpi.receivable.value, true)}</div>
          <div className="sub">as of {dmy(d.kpi.receivable.asOf)}</div>
        </div>
        <div className="k">
          <div className="top">
            <span className="lab">Cash Balance</span>
            <span className="icon ic-violet"><CreditCard /></span>
          </div>
          <div className="v">{peso(d.kpi.cashBalance.value, true)}</div>
          <Delta change={d.kpi.cashBalance.change} />
        </div>
      </div>

      <div className="two">
        <div className="sheet">
          <div className="hd">
            <div><span className="lab">Last 6 months</span><h2>Cash Flow Overview</h2></div>
          </div>
          <div className="chartwrap">
            {cashFlow.every((m) => m.in === 0 && m.out === 0) ? (
              <div className="empty">No cash movement recorded yet.</div>
            ) : (
              <CashFlowChart data={cashFlow} inColor={tenant.branding.positive} outColor={tenant.branding.negative} netColor={tenant.branding.accent} />
            )}
          </div>
        </div>

        <div className="sheet">
          <div className="hd">
            <div><span className="lab">{dmy(range.from)} &ndash; {dmy(range.to)}</span><h2>Expenses by Category</h2></div>
          </div>
          <div className="bd">
            {!topCats.length ? (
              <div className="empty">No costs recorded in this period.</div>
            ) : (
              <CategoryDonut data={topCats} colors={CATEGORY_COLORS} />
            )}
          </div>
        </div>
      </div>

      <div className="sheet">
        <div className="hd">
          <div><span className="lab">Every job, every peso</span><h2>Project Summary</h2></div>
        </div>
        <div className="bd flush"><div className="scroll"><table>
          <thead><tr><th>Project</th><th>Client</th><th className="r">Contract</th><th className="r">Billed to Date</th><th className="r">Cost to Date</th><th className="r">Margin</th><th>Status</th></tr></thead>
          <tbody>
            {!d.projects.length ? (
              <tr><td colSpan={7} className="empty">Add a project to begin.</td></tr>
            ) : d.projects.map((p) => {
              const st = /on.?going|active/i.test(p.status || "") ? "go" : /hold|pending/i.test(p.status || "") ? "hold" : "";
              return (
                <tr key={p.id}>
                  <td>
                    <div className="rowmeta">
                      <div className="thumb"><Building2 size={16} /></div>
                      <div>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{p.name}</div>
                        <div className="id">{p.no || ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>{p.client || ""}</td>
                  <td className="r">{peso(p.contract)}</td>
                  <td className="r pos">{peso(p.collected)}</td>
                  <td className="r">{peso(p.expenses)}</td>
                  <td className={`r ${p.netPL < 0 ? "neg" : "pos"}`} style={{ fontWeight: 600 }}><span className="num">{pct(p.margin)}</span></td>
                  <td><span className={`tag ${st}`}>{p.status || "-"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>

      <div className="two" style={{ gridTemplateColumns: "1.3fr .8fr 1fr" }}>
        <div className="sheet">
          <div className="hd"><div><span className="lab">Latest first</span><h2>Recent Activity</h2></div></div>
          <div className="activity">
            {!d.recent.length ? (
              <div className="empty">Nothing recorded yet.</div>
            ) : d.recent.map((r) => {
              const Icon = REGISTER_ICON[r.register];
              const cls = r.dir === "in" ? "pos" : r.dir === "out" ? "neg" : "";
              const sgn = r.dir === "in" ? "+" : r.dir === "out" ? "-" : "";
              const tint = r.dir === "in" ? "ic-aqua" : r.dir === "out" ? "ic-orange" : "ic-violet";
              return (
                <div className="row" key={r.register + r.id}>
                  <span className={`ic ${tint}`}><Icon /></span>
                  <div className="body">
                    <div className="t">{r.label || r.id}{r.voided && " (voided)"}</div>
                    <div className="m">{dmy(r.date)} &middot; {r.by}</div>
                  </div>
                  <div className={`amt ${r.voided ? "" : cls}`} style={r.voided ? { color: "var(--void)", textDecoration: "line-through" } : undefined}>
                    {sgn}{peso(r.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sheet">
          <div className="hd"><div><span className="lab">At a glance</span><h2>Quick Summary</h2></div></div>
          <div className="qstats">
            <div className="row">
              <span className="ic ic-yellow"><Landmark size={15} /></span>
              <span className="t">Receivable</span>
              <span className="v">{peso(d.kpi.receivable.value)}</span>
            </div>
            <div className="row">
              <span className="ic ic-blue"><CreditCard size={15} /></span>
              <span className="t">Bank Balance</span>
              <span className="v">{peso(d.bankTotal)}</span>
            </div>
            <div className="row">
              <span className="ic ic-aqua"><Wallet size={15} /></span>
              <span className="t">Cash on Hand</span>
              <span className="v">{peso(d.cashTotal)}</span>
            </div>
            <div className="row">
              <span className="ic ic-violet"><Building2 size={15} /></span>
              <span className="t">Active Projects</span>
              <span className="v">{d.counts.active} <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>/ {d.counts.projects}</span></span>
            </div>
          </div>
        </div>

        {session.perms.canReport && tenant.features.reports ? (
          <div className="cta">
            <div className="ic"><FileBarChart2 /></div>
            <h3>Generate Financial Report</h3>
            <p>Create a project or period report, ready to print or save as PDF.</p>
            <Link href={`/t/${slug}/reports`}><button className="btn" type="button">Generate Now</button></Link>
          </div>
        ) : (
          <div className="sheet" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 22, textAlign: "center", gap: 8 }}>
            <div className="lab">This period</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{d.counts.entries} live entries &middot; {d.counts.voided} voided</div>
          </div>
        )}
      </div>
    </>
  );
}
