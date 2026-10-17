import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { PLANS, isPlanKey } from "@/lib/firm/plans";
import { dmy } from "@/lib/format";

export default async function LeadsPage() {
  await requireStaff();
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { orders: { select: { status: true } } } });
  return (
    <>
      <div className="pagehd"><div><h1>Leads</h1><div className="sub">Everyone who finished the readiness check. Newest first.</div></div></div>
      <div className="sheet"><div className="bd flush"><div className="scroll">
        {leads.length === 0 ? <div className="empty">No leads yet.</div> : (
          <table>
            <thead><tr><th>Date</th><th>Business</th><th>Contact</th><th className="r">Score</th><th>Suggested</th><th>Status</th></tr></thead>
            <tbody>
              {leads.map((l) => {
                const paid = l.orders.some((o) => o.status === "PAID");
                const pending = l.orders.some((o) => o.status === "PENDING");
                return (
                  <tr key={l.id}>
                    <td>{dmy(l.createdAt)}</td>
                    <td>{l.businessName}<div className="id">{l.name}</div></td>
                    <td>{l.email}{l.phone && <div className="id">{l.phone}</div>}</td>
                    <td className="r num">{l.score}</td>
                    <td>{isPlanKey(l.planKey) ? PLANS[l.planKey].name : l.planKey}</td>
                    <td><span className={`tag ${paid ? "go" : pending ? "hold" : ""}`}>{paid ? "Paid" : pending ? "Started checkout" : "Quiz only"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div></div></div>
    </>
  );
}
