import { guard } from "../guard";
import Flash from "../Flash";
import { addFxAction } from "../actions";
import { db } from "@/lib/db";
import { CURRENCIES } from "@/lib/finance/money";
import { dmy, todayIso } from "@/lib/format";

export default async function FxPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ err?: string; ok?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await guard(slug);
  const rates = await db.fxRate.findMany({ where: { tenantId: tenant.id }, orderBy: { asOf: "desc" }, take: 50 });
  const action = addFxAction.bind(null, slug);
  const opts = CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>);

  return (
    <>
      <Flash err={sp.err} ok={sp.ok} />
      <div className="pagehd"><div><h1>FX rates</h1><div className="sub">1 unit of “from” = rate units of “to”. Each posting freezes the rate in effect on its date.</div></div></div>
      {canManage && (
        <div className="sheet" style={{ marginBottom: 18 }}><div className="bd">
          <form action={action}>
            <div className="grid2">
              <div className="field"><label htmlFor="from">From</label><select id="from" name="from" defaultValue="USD">{opts}</select></div>
              <div className="field"><label htmlFor="to">To</label><select id="to" name="to" defaultValue={tenant.baseCurrency}>{opts}</select></div>
              <div className="field money"><label htmlFor="rate">Rate</label><input id="rate" name="rate" inputMode="decimal" required /></div>
              <div className="field"><label htmlFor="asOf">As of</label><input id="asOf" name="asOf" type="date" defaultValue={todayIso()} required /></div>
            </div>
            <button className="btn" type="submit">Save rate</button>
          </form>
        </div></div>
      )}
      <div className="sheet"><div className="bd flush">
        <table><thead><tr><th>Pair</th><th>Rate</th><th>As of</th><th>Source</th></tr></thead>
          <tbody>{rates.map((r) => <tr key={r.id}><td>{r.fromCcy} → {r.toCcy}</td><td>{Number(r.rate)}</td><td>{dmy(r.asOf)}</td><td>{r.source}</td></tr>)}
            {!rates.length && <tr><td colSpan={4} style={{ color: "var(--ink-2)" }}>No rates yet. Properties in {tenant.baseCurrency} need none.</td></tr>}
          </tbody></table>
      </div></div>
    </>
  );
}
