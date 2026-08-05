import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard";
import { peso, pct, dmy } from "@/lib/format";

export default async function DashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.seeAllEntries) redirect(`/t/${slug}/ledger`);

  const d = await getDashboard(tenant.id, session);
  const asOf = new Date().toLocaleString("en-PH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const topCats = d.categories.slice(0, 8);
  const maxCat = topCats.length ? topCats[0].amount : 1;

  return (
    <>
      <div className="titleblock">
        <div className="cell wide">
          <span className="lab">Company</span>
          <div className="v">{tenant.branding.company || "Untitled"}</div>
        </div>
        <div className="cell">
          <span className="lab">Projects</span>
          <div className="v">
            <span className="num">{d.counts.active}</span>
            <span style={{ color: "var(--ink-3)", fontSize: 13, fontWeight: 400 }}> of {d.counts.projects} active</span>
          </div>
        </div>
        <div className="cell">
          <span className="lab">As of</span>
          <div className="v" style={{ fontSize: 13 }}>{asOf}</div>
          <div className="lab" style={{ marginTop: 5 }}>{d.counts.entries} entries &middot; {d.counts.voided} voided</div>
        </div>
      </div>

      <div className="rack">
        <div className="k"><span className="lab">Contract Value</span><div className="v">{peso(d.kpi.contract)}</div><div className="sub">across all projects</div></div>
        <div className="k"><span className="lab">Collected</span><div className="v pos">{peso(d.kpi.collected)}</div><div className="sub">net of EWT</div></div>
        <div className="k"><span className="lab">Receivable</span><div className={`v ${d.kpi.receivable > 0 ? "neg" : ""}`}>{peso(d.kpi.receivable, true)}</div><div className="sub">still to collect</div></div>
        <div className="k"><span className="lab">Net Position</span><div className={`v ${d.kpi.netPL < 0 ? "neg" : "pos"}`}>{peso(d.kpi.netPL, true)}</div><div className="sub">collected less cost</div></div>
      </div>

      <div className="two">
        <div className="sheet">
          <div className="hd">
            <div><span className="lab">Where the money is</span><h2>Cash Position</h2></div>
            <div style={{ textAlign: "right" }}><span className="lab">Total</span><div style={{ fontWeight: 600, marginTop: 4 }}>{peso(d.bankTotal + d.cashTotal, true)}</div></div>
          </div>
          <div className="bd flush"><div className="scroll"><table><tbody>
            {!d.accounts.length ? (
              <tr><td className="empty">No accounts yet. Ask the Owner to add one.</td></tr>
            ) : d.accounts.map((a) => (
              <tr key={a.name}>
                <td>{a.name}<div className="lab" style={{ marginTop: 3 }}>{a.kind}</div></td>
                <td className={`r ${a.balance < 0 ? "neg" : ""}`} style={{ fontWeight: 600 }}>{peso(a.balance, true)}</td>
              </tr>
            ))}
          </tbody></table></div></div>
        </div>

        <div className="sheet">
          <div className="hd">
            <div><span className="lab">Where it went</span><h2>Cost Breakdown</h2></div>
            <div style={{ textAlign: "right" }}><span className="lab">Total</span><div style={{ fontWeight: 600, marginTop: 4 }}>{peso(d.kpi.expenses)}</div></div>
          </div>
          <div className="bd"><div className="bars">
            {!topCats.length ? (
              <div className="empty">No costs recorded yet.</div>
            ) : topCats.map((c) => {
              const w = Math.max(2, (c.amount / maxCat) * 100);
              return (
                <div className="r" key={c.name}>
                  <div className="t">{c.name}</div>
                  <div className="amt">{peso(c.amount)}</div>
                  <div className="track"><div className="fill" style={{ width: `${w.toFixed(1)}%` }} /></div>
                </div>
              );
            })}
          </div></div>
        </div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Every job, every peso</span><h2>Projects</h2></div></div>
        <div className="bd flush"><div className="scroll"><table>
          <thead><tr><th>Project</th><th>Client</th><th className="r">Contract</th><th className="r">Collected</th><th className="r">Receivable</th><th className="r">Cost</th><th className="r">Net</th><th className="r">Margin</th><th>Status</th></tr></thead>
          <tbody>
            {!d.projects.length ? (
              <tr><td colSpan={9} className="empty">Add a project to begin.</td></tr>
            ) : d.projects.map((p) => {
              const st = /on.?going|active/i.test(p.status || "") ? "go" : /hold|pending/i.test(p.status || "") ? "hold" : "";
              return (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="id">{p.no || ""}</div></td>
                  <td>{p.client || ""}</td>
                  <td className="r">{peso(p.contract)}</td>
                  <td className="r pos">{peso(p.collected)}</td>
                  <td className={`r ${p.balance > 0 ? "neg" : ""}`}>{peso(p.balance, true)}</td>
                  <td className="r">{peso(p.expenses)}</td>
                  <td className={`r ${p.netPL < 0 ? "neg" : "pos"}`} style={{ fontWeight: 600 }}>{peso(p.netPL, true)}</td>
                  <td className="r"><span className="num">{pct(p.margin)}</span></td>
                  <td><span className={`tag ${st}`}>{p.status || "-"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Latest first</span><h2>Recent Activity</h2></div></div>
        <div className="bd flush"><div className="scroll"><table>
          <thead><tr><th>Entry</th><th>Date</th><th>Particulars</th><th>Project</th><th>By</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {!d.recent.length ? (
              <tr><td colSpan={6} className="empty">Nothing recorded yet.</td></tr>
            ) : d.recent.map((r) => {
              const sgn = r.dir === "in" ? "+" : r.dir === "out" ? "-" : "";
              const cls = r.dir === "in" ? "pos" : r.dir === "out" ? "neg" : "";
              return (
                <tr key={r.register + r.id} className={r.voided ? "voided" : ""}>
                  <td><span className="id">{r.id}</span>{r.voided && <> <span className="tag void">Void</span></>}</td>
                  <td>{dmy(r.date)}</td>
                  <td>{r.label || ""}</td>
                  <td>{r.project || "-"}</td>
                  <td>{r.by || ""}</td>
                  <td className={`r ${cls}`} style={{ fontWeight: 600 }}>{sgn}{peso(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      </div>
    </>
  );
}

