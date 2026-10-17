import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { dmy } from "@/lib/format";

export default async function ClientsPage() {
  await requireStaff();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const tenants = await db.tenant.findMany({
    where: { kind: "SELLER" },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      order: { include: { lead: true } },
      consults: { orderBy: { createdAt: "desc" }, take: 1 },
      deadlines: { where: { status: "OPEN" }, select: { dueDate: true } },
    },
  });

  return (
    <>
      <div className="pagehd"><div><h1>Clients</h1><div className="sub">{tenants.length} workspace{tenants.length === 1 ? "" : "s"}</div></div></div>
      <div className="sheet"><div className="bd flush"><div className="scroll">
        {tenants.length === 0 ? <div className="empty">No clients yet. They appear here when a payment clears.</div> : (
          <table>
            <thead><tr><th>Business</th><th>Contact</th><th>Plan</th><th>Joined</th><th>Consult</th><th className="r">Filings</th><th></th></tr></thead>
            <tbody>
              {tenants.map((t) => {
                const c = t.consults[0];
                const overdue = t.deadlines.filter((d) => d.dueDate < today).length;
                return (
                  <tr key={t.id}>
                    <td><Link href={`/admin/clients/${t.id}`} style={{ fontWeight: 600 }}>{t.name}</Link><div className="id">/t/{t.slug}</div></td>
                    <td>{t.order?.lead.name}<div className="id">{t.order?.lead.email}</div></td>
                    <td>{t.order?.planKey ?? "-"}</td>
                    <td>{dmy(t.createdAt)}</td>
                    <td>{c ? <span className={`tag ${c.status === "SCHEDULED" ? "go" : c.status === "REQUESTED" ? "hold" : ""}`}>{c.status.toLowerCase()}</span> : "-"}</td>
                    <td className="r">{overdue > 0 ? <span className="tag bad">{overdue} overdue</span> : <span className="num">{t.deadlines.length} open</span>}</td>
                    <td className="r"><Link href={`/admin/clients/${t.id}`}><button className="btn ghost" type="button" style={{ width: "auto", padding: "6px 11px" }}>Open</button></Link></td>
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
