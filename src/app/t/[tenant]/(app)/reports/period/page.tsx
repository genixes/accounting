import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { renderPeriodReport } from "@/lib/reports";
import { peso, pct, dmy } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function PeriodReportPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.canReport || !tenant.features.reports) redirect(`/t/${slug}/dashboard`);

  const r = await renderPeriodReport(tenant.id, session, sp.from, sp.to);
  if (!r.ok) return <div className="msg err show">{r.errors.join(" ")}</div>;

  return (
    <div className="sheet" style={{ maxWidth: 960 }}>
      <div className="hd no-print">
        <div><span className="lab">Every job, one window</span><h2>Period Report</h2></div>
        <PrintButton />
      </div>
      <div className="bd">
        <div style={{ fontWeight: 700, fontSize: 18 }}>{tenant.branding.company}</div>
        <div style={{ color: "var(--accent)", fontWeight: 700 }}>PERIOD REPORT</div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.range}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 18 }}>
          Generated {new Date().toLocaleString("en-PH")} by {session.name}. Voided entries are excluded.
        </div>

        <Band text="COMPANY SUMMARY FOR THE PERIOD" />
        <Kv label="Billed" value={peso(r.totBil)} />
        <Kv label="EWT deducted" value={peso(r.totEwt)} />
        <Kv label="Received" value={peso(r.totCol)} />
        <Kv label="Materials and other costs" value={peso(r.totExp)} />
        <Kv label="Payroll (gross)" value={peso(r.totPay)} />
        <Kv label="Total cost" value={peso(r.cost)} bold />
        <Kv label="NET FOR THE PERIOD" value={peso(r.net, true)} cls={r.net < 0 ? "neg" : "pos"} bold big />

        <Band text="BY PROJECT" />
        <table><thead><tr><th>Project</th><th className="r">Received</th><th className="r">Cost</th><th className="r">Net</th><th className="r">Margin on receipts</th></tr></thead>
          <tbody>
            {!r.byProject.length ? <tr><td colSpan={5} className="empty">No entries.</td></tr> :
              r.byProject.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td className="r">{peso(p.collected)}</td><td className="r">{peso(p.cost)}</td><td className="r">{peso(p.net, true)}</td><td className="r">{pct(p.margin)}</td></tr>
              ))}
          </tbody>
        </table>

        <Band text="COST BY CATEGORY" />
        <table><thead><tr><th>Category</th><th className="r">Amount</th><th className="r">% of cost</th></tr></thead>
          <tbody>
            {!r.byCategory.length ? <tr><td colSpan={3} className="empty">No entries.</td></tr> :
              r.byCategory.map(([k, amt]) => (
                <tr key={k}><td>{k}</td><td className="r">{peso(amt)}</td><td className="r">{pct(r.cost ? amt / r.cost : 0)}</td></tr>
              ))}
          </tbody>
        </table>

        <Band text="COLLECTIONS IN THE PERIOD" />
        <table><thead><tr><th>Date</th><th>Project</th><th>Particulars</th><th className="r">Billed</th><th className="r">EWT</th><th className="r">Received</th><th>Deposited To</th></tr></thead>
          <tbody>
            {!r.collections.length ? <tr><td colSpan={7} className="empty">No entries.</td></tr> :
              r.collections.map((c, i) => (
                <tr key={i}><td>{dmy(c.date)}</td><td>{c.project}</td><td>{c.particulars}</td><td className="r">{peso(c.billed)}</td><td className="r">{peso(c.ewt)}</td><td className="r">{peso(c.received)}</td><td>{c.depositedTo}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Band({ text }: { text: string }) {
  return <div style={{ background: "var(--sheet-2)", color: "#fff", border: "1px solid var(--rule)", padding: "6px 10px", fontWeight: 700, fontSize: 12, margin: "18px 0 10px" }}>{text}</div>;
}
function Kv({ label, value, cls, bold, big }: { label: string; value: string; cls?: string; bold?: boolean; big?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "3px 0" }}>
      <div style={{ width: 220, fontWeight: 700, fontSize: big ? 15 : 13 }}>{label}</div>
      <div className={cls} style={{ fontWeight: bold ? 700 : 400, fontSize: big ? 15 : 13 }}>{value}</div>
    </div>
  );
}
