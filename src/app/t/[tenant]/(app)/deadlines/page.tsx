import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { dmy } from "@/lib/format";
import { classifyDeadline } from "@/lib/firm/deadlines";

export default async function DeadlinesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (tenant.kind !== "SELLER") redirect(`/t/${slug}/dashboard`);

  const rows = await db.complianceDeadline.findMany({ where: { tenantId: tenant.id }, orderBy: [{ status: "asc" }, { dueDate: "asc" }], take: 200 });
  const now = new Date();

  return (
    <>
      <div className="pagehd">
        <div>
          <h1>Filing dates</h1>
          <div className="sub">Set and kept up to date by your accountant.</div>
        </div>
      </div>
      <div className="sheet">
        <div className="bd flush">
          {rows.length === 0 ? (
            <div className="empty">Your accountant will add your filing dates after your first consultation.</div>
          ) : (
            <div className="scroll"><table>
              <thead><tr><th>Due</th><th>What</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((d) => {
                  const st = classifyDeadline(d, now);
                  return (
                    <tr key={d.id} className={st.key === "done" ? "voided" : ""}>
                      <td>{dmy(d.dueDate)}</td>
                      <td>{d.title}{d.notes && <div className="id">{d.notes}</div>}</td>
                      <td><span className={`tag ${st.tone}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  );
}
