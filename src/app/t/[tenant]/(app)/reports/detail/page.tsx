import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { renderProjectDetail } from "@/lib/reports";
import { n, grossPayroll, netCollection } from "@/lib/aggregate";
import { peso, pct, dmy } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function ProjectDetailReportPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ project?: string; from?: string; to?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.canReport || !tenant.features.reports) redirect(`/t/${slug}/dashboard`);
  if (!sp.project) redirect(`/t/${slug}/reports`);

  const r = await renderProjectDetail(tenant.id, session, sp.project, sp.from, sp.to);
  if (!r.ok) {
    return <div className="msg err show">{r.errors.join(" ")}</div>;
  }

  const { project: p, facts: F, dated } = r;

  return (
    <div className="sheet" style={{ maxWidth: 900 }}>
      <div className="hd no-print">
        <div><span className="lab">Internal view</span><h2>Project Detail View</h2></div>
        <PrintButton />
      </div>
      <div className="bd">
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{tenant.branding.company}</div>
        <div style={{ color: "var(--accent)", fontWeight: 700, marginBottom: 2 }}>PROJECT DETAIL VIEW</div>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.range}</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic", marginBottom: 18 }}>
          Generated {new Date().toLocaleString("en-PH")} by {session.name}. Voided entries are excluded.
        </div>

        <Band text="PROJECT" />
        <Kv label="Project No." value={p.no || ""} />
        <Kv label="Project Name" value={p.name} />
        <Kv label="Client / Owner" value={p.client || ""} />
        <Kv label="Status" value={p.status} />
        <Kv label="Start Date" value={dmy(p.startDate)} />
        <Kv label="Completion Date" value={dmy(p.endDate)} />

        {dated && (
          <>
            <Band text="THIS PERIOD" />
            <Kv label="Collected in period" value={peso(F.periodCollected)} />
            <Kv label="Spent in period" value={peso(F.periodExpenses)} />
            <Kv label="Net in period" value={peso(F.periodNet, true)} cls={F.periodNet < 0 ? "neg" : "pos"} bold />
          </>
        )}

        <Band text={dated ? "PROJECT TO DATE (as of the end date)" : "FINANCIAL SUMMARY"} />
        <Kv label="Contract Amount" value={peso(n(p.contract))} />
        <Kv label="Collected to date" value={peso(F.toDateCollected)} />
        <Kv label="Balance to Collect" value={peso(r.toDateBalance, true)} />
        <Kv label="Spent to date" value={peso(F.toDateExpenses)} />
        <Kv label="Net Profit / Loss" value={peso(r.toDateNet, true)} cls={r.toDateNet < 0 ? "neg" : "pos"} bold />
        <Kv label="Profit Margin" value={pct(n(p.contract) ? r.toDateNet / n(p.contract) : 0)} />

        <Band text={dated ? "EXPENSES BY CATEGORY (period)" : "EXPENSES BY CATEGORY"} />
        <table><thead><tr><th>Category</th><th className="r">Amount</th><th className="r">% of Total</th></tr></thead>
          <tbody>
            {!r.categoryBreakdown.length ? <tr><td colSpan={3} className="empty">No entries.</td></tr> :
              r.categoryBreakdown.map(([k, amt]) => (
                <tr key={k}><td>{k}</td><td className="r">{peso(amt)}</td><td className="r">{pct(F.periodExpenses ? amt / F.periodExpenses : 0)}</td></tr>
              ))}
          </tbody>
        </table>

        <Band text="COLLECTIONS" />
        <table><thead><tr><th>Date</th><th>Particulars</th><th className="r">Bill Amount</th><th className="r">EWT</th><th className="r">Net Received</th><th>Deposited To</th></tr></thead>
          <tbody>
            {!F.col.length ? <tr><td colSpan={6} className="empty">No entries.</td></tr> :
              F.col.map((c) => (
                <tr key={c.entryId}><td>{dmy(c.date)}</td><td>{c.particulars}</td><td className="r">{peso(n(c.billAmount))}</td><td className="r">{peso(n(c.ewt))}</td><td className="r">{peso(netCollection(c))}</td><td>{c.depositedTo}</td></tr>
              ))}
          </tbody>
        </table>

        <Band text="EXPENSE DETAIL" />
        <table><thead><tr><th>Date</th><th>Particulars</th><th>Category</th><th>Supplier</th><th className="r">Amount</th><th>Paid From</th></tr></thead>
          <tbody>
            {!F.exp.length ? <tr><td colSpan={6} className="empty">No entries.</td></tr> :
              F.exp.map((e) => (
                <tr key={e.entryId}><td>{dmy(e.date)}</td><td>{e.particulars}</td><td>{e.category}</td><td>{e.supplier || ""}</td><td className="r">{peso(n(e.amount))}</td><td>{e.paidFrom}</td></tr>
              ))}
          </tbody>
        </table>

        <Band text="PAYROLL DETAIL" />
        <table><thead><tr><th>Pay Date</th><th>Pay Period</th><th>Workers</th><th className="r">Gross</th><th className="r">Net Paid</th><th>Paid By</th></tr></thead>
          <tbody>
            {!F.pay.length ? <tr><td colSpan={6} className="empty">No entries.</td></tr> :
              F.pay.map((pr) => (
                <tr key={pr.entryId}><td>{dmy(pr.payDate)}</td><td>{pr.payPeriod}</td><td>{pr.workers || ""}</td><td className="r">{peso(grossPayroll(pr))}</td>
                  <td className="r">{peso(grossPayroll(pr) + n(pr.caGiven) - n(pr.deductions) - n(pr.caDeduction))}</td><td>{pr.paidBy}</td></tr>
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
function Kv({ label, value, cls, bold }: { label: string; value: string; cls?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "3px 0" }}>
      <div style={{ width: 200, fontWeight: 700, fontSize: 13 }}>{label}</div>
      <div className={cls} style={{ fontWeight: bold ? 700 : 400, fontSize: 13 }}>{value}</div>
    </div>
  );
}
