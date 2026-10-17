import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { scanAll } from "@/lib/aggregate";
import { peso } from "@/lib/format";
import { monthLabel, monthOrCurrent, shiftMonth, summariseMonth } from "@/lib/summary";
import PrintButton from "@/components/PrintButton";

export default async function SummaryPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (tenant.kind !== "SELLER" || !session.perms.canReport) redirect(`/t/${slug}/dashboard`);

  const month = monthOrCurrent(sp.m);
  const all = await scanAll(tenant.id);
  const s = summariseMonth(all, month);
  const base = `/t/${slug}/summary`;

  return (
    <>
      <div className="pagehd">
        <div>
          <h1>Monthly summary</h1>
          <div className="sub">{monthLabel(month)} &middot; {s.entryCount} entr{s.entryCount === 1 ? "y" : "ies"}</div>
        </div>
        <div className="tools">
          <Link href={`${base}?m=${shiftMonth(month, -1)}`}><button className="btn ghost" type="button" style={{ width: "auto" }}>&larr; Previous</button></Link>
          <Link href={`${base}?m=${shiftMonth(month, 1)}`}><button className="btn ghost" type="button" style={{ width: "auto" }}>Next &rarr;</button></Link>
          <PrintButton />
        </div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">What came in</span><h2>Sales</h2></div></div>
        <div className="bd flush"><table><tbody>
          <tr><td>Sales</td><td className="r num">{peso(s.sales)}</td></tr>
          <tr><td>Less: tax withheld by platforms and clients</td><td className="r num neg">({peso(s.withheld)})</td></tr>
          <tr><td style={{ fontWeight: 600 }}>Received</td><td className="r num" style={{ fontWeight: 600 }}>{peso(s.received)}</td></tr>
        </tbody></table></div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">What went out</span><h2>Costs</h2></div></div>
        <div className="bd flush"><table><tbody>
          {s.costsByCategory.length === 0 && <tr><td colSpan={2} className="empty">No costs recorded this month.</td></tr>}
          {s.costsByCategory.map((c) => (
            <tr key={c.category}><td>{c.category}</td><td className="r num">{peso(c.amount)}</td></tr>
          ))}
          <tr><td style={{ fontWeight: 600 }}>Total costs</td><td className="r num" style={{ fontWeight: 600 }}>{peso(s.costs)}</td></tr>
        </tbody></table></div>
      </div>

      <div className="sheet">
        <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="lab" style={{ marginBottom: 6 }}>Left after costs</div>
            <div style={{ color: "var(--ink-3)", fontSize: 13 }}>Received less costs. This is not a tax computation. Ask your accountant what is due.</div>
          </div>
          <div className={`num ${s.leftAfterCosts < 0 ? "neg" : "pos"}`}
            style={{ fontSize: 30, fontWeight: 600, borderBottom: "4px double currentColor", paddingBottom: 3 }}>
            {peso(s.leftAfterCosts, true)}
          </div>
        </div>
      </div>
    </>
  );
}
