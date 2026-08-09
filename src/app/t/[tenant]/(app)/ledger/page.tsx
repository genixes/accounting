import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenant, type FeatureKey } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { REGISTERS } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";
import { getRegisterRows } from "@/lib/register-view";
import { listsForSession } from "@/lib/lists";
import { peso, dmy } from "@/lib/format";

const REGISTER_FEATURE: Partial<Record<RegisterKey, FeatureKey>> = {
  PAYROLL: "payroll",
  COLLECTION: "collection",
  TRANSFERS: "transfers",
};

export default async function LedgerPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ r?: string; p?: string; q?: string; hv?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const availableRegisters = session.perms.add.filter((r) => {
    const feature = REGISTER_FEATURE[r];
    return !feature || tenant.features[feature];
  });
  const regKey = (sp.r && availableRegisters.includes(sp.r as RegisterKey) ? sp.r : availableRegisters[0]) as RegisterKey;

  const [lists, result] = await Promise.all([
    listsForSession(tenant.id, session),
    getRegisterRows(tenant.id, session, regKey, {
      project: sp.p, q: sp.q, hideVoided: sp.hv === "1", limit: 120,
    }),
  ]);

  const cfg = REGISTERS[regKey];
  const dirClass = cfg.dir === "in" ? "pos" : cfg.dir === "out" ? "neg" : "";

  return (
    <div className="sheet">
      <div className="hd"><div><span className="lab">Search and filter</span><h2>Ledger</h2></div></div>
      <form className="filters" method="get">
        <select name="r" defaultValue={regKey}>
          {availableRegisters.map((r) => <option key={r} value={r}>{REGISTERS[r].plural}</option>)}
        </select>
        <select name="p" defaultValue={sp.p || ""}>
          <option value="">All projects</option>
          {lists.projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="search" name="q" placeholder="Search particulars, entry ID, person" defaultValue={sp.q || ""} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" name="hv" value="1" defaultChecked={sp.hv === "1"} style={{ width: "auto" }} /> Hide voided
        </label>
        <button className="btn ghost" type="submit" style={{ width: "auto" }}>Apply</button>
      </form>

      <div className="bd flush">
        {!result.rows.length ? (
          <div className="empty">Nothing matches. Try a wider filter.</div>
        ) : (
          <div className="scroll"><table>
            <thead><tr><th>Entry</th><th>Date</th><th>Particulars</th><th>Project</th><th>By</th><th className="r">Amount</th>{result.canVoid && <th></th>}</tr></thead>
            <tbody>
              {result.rows.map((x) => (
                <tr key={x.id} className={x.voided ? "voided" : ""}>
                  <td><span className="id">{x.id}</span>{x.voided && <> <span className="tag void">Void</span></>}</td>
                  <td>{dmy(x.date)}</td>
                  <td>{x.label}</td>
                  <td>{x.project || "-"}</td>
                  <td>{x.by}</td>
                  <td className={`r ${dirClass}`} style={{ fontWeight: 600 }}>{peso(x.amount)}</td>
                  {result.canVoid && (
                    <td className="r">
                      {!x.voided && (
                        <Link href={`/t/${slug}/ledger/void/${regKey}/${x.id}`}>
                          <button className="btn ghost" type="button" style={{ width: "auto", padding: "6px 11px" }}>Void</button>
                        </Link>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--rule)", display: "flex", justifyContent: "space-between", background: "var(--sheet-2)" }}>
          <span className="lab">{result.rows.length} shown</span>
          <span style={{ fontWeight: 600 }}>{peso(result.liveTotal)}</span>
        </div>
      </div>
    </div>
  );
}
