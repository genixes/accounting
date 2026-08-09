import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { renderProjectReport } from "@/lib/reports";
import { n, netCollection } from "@/lib/aggregate";
import { peso, dmy } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export default async function ProjectReportPage({
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

  const r = await renderProjectReport(tenant.id, session, sp.project, sp.from, sp.to);
  if (!r.ok) return <div className="msg err show">{r.errors.join(" ")}</div>;

  const { project: p, facts: F, dated } = r;

  return (
    <div className="sheet" style={{ maxWidth: 800 }}>
      <div className="hd no-print">
        <div><span className="lab">Client-facing</span><h2>Project Report</h2></div>
        <PrintButton />
      </div>
      <div className="bd">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          {tenant.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.branding.logoUrl} alt={tenant.branding.company} style={{ maxHeight: 60 }} />
          ) : <div style={{ fontWeight: 700, fontSize: 20 }}>{tenant.branding.company}</div>}
        </div>

        <div style={{ background: "var(--sheet-2)", color: "#fff", border: "1px solid var(--rule)", padding: "10px 14px", fontWeight: 700, marginBottom: 14 }}>PROJECT FINANCIAL REPORT</div>

        <Kv label="Project No." value={p.no || ""} />
        <Kv label="Project Name" value={p.name} />
        <Kv label="Client / Owner" value={p.client || ""} />
        <Kv label="Status" value={p.status} />
        <Kv label="Period Covered" value={r.range} bold />
        <Kv label="Report Date" value={new Date().toLocaleDateString("en-PH", { day: "2-digit", month: "long", year: "numeric" })} />

        {dated && (
          <>
            <Band text="THIS PERIOD" />
            <Kv label="Billed in period" value={peso(F.periodBilled)} />
            <Kv label="EWT deducted" value={peso(F.periodEwt)} />
            <Kv label="Received in period" value={peso(F.periodCollected)} bold />
          </>
        )}

        <Band text={dated ? "PROJECT TO DATE (as of the end date)" : "SUMMARY"} />
        <Kv label="Contract Amount" value={peso(n(p.contract))} />
        <Kv label="Collected to date" value={peso(F.toDateCollected)} />
        <Kv label="Balance to Collect" value={peso(r.toDateBalance, true)} cls={r.toDateBalance > 0 ? "neg" : "pos"} bold />

        <Band text={dated ? "COLLECTIONS IN THIS PERIOD" : "COLLECTION DETAILS"} />
        <table><thead><tr><th>Date</th><th>Particulars</th><th className="r">Bill Amount</th><th className="r">EWT Deducted</th><th className="r">Net Received</th></tr></thead>
          <tbody>
            {!F.col.length ? <tr><td colSpan={5} className="empty">No entries.</td></tr> :
              F.col.map((c) => (
                <tr key={c.entryId}><td>{dmy(c.date)}</td><td>{c.particulars}</td><td className="r">{peso(n(c.billAmount))}</td><td className="r">{peso(n(c.ewt))}</td><td className="r">{peso(netCollection(c))}</td></tr>
              ))}
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 60 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Prepared By:</div>
            <div style={{ borderTop: "1px solid var(--ink-3)", marginTop: 40, paddingTop: 4, fontSize: 11, fontStyle: "italic", color: "var(--ink-3)" }}>Signature over Printed Name</div>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Checked By:</div>
            <div style={{ borderTop: "1px solid var(--ink-3)", marginTop: 40, paddingTop: 4, fontSize: 11, fontStyle: "italic", color: "var(--ink-3)" }}>Signature over Printed Name</div>
          </div>
        </div>
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
