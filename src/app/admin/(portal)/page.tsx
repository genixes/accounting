import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { formatPeso } from "@/lib/firm/plans";
import { dmy } from "@/lib/format";
import { formatManila } from "@/lib/firm/staff";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const now = new Date();
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const month = new Date(now.getTime() - 30 * 86_400_000);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [toSchedule, reviews, newLeads, paid, overdue, upcoming] = await Promise.all([
    db.consult.findMany({ where: { status: "REQUESTED" }, include: { lead: true }, orderBy: { createdAt: "asc" }, take: 10 }),
    db.paymentEvent.findMany({ where: { outcome: { startsWith: "needs_review" } }, orderBy: { receivedAt: "desc" }, take: 10 }),
    db.lead.count({ where: { createdAt: { gte: week } } }),
    db.order.aggregate({ where: { status: "PAID", paidAt: { gte: month } }, _sum: { amount: true }, _count: true }),
    db.complianceDeadline.count({ where: { status: "OPEN", dueDate: { lt: today } } }),
    db.consult.findMany({ where: { status: "SCHEDULED", scheduledFor: { gte: now } }, include: { lead: true, tenant: true }, orderBy: { scheduledFor: "asc" }, take: 8 }),
  ]);

  return (
    <>
      <div className="pagehd"><div><h1>Overview</h1><div className="sub">Signed in as {staff.name} ({staff.role.toLowerCase()})</div></div></div>
      {sp.denied && <div className="msg err show" style={{ marginBottom: 18 }}>Your role cannot do that.</div>}

      <div className="rack">
        <div className="k"><span className="lab">Consults to schedule</span><div className="v">{toSchedule.length}</div><div className="sub">paid clients waiting</div></div>
        <div className="k"><span className="lab">Payments to review</span><div className="v" style={{ color: reviews.length ? "var(--out)" : undefined }}>{reviews.length}</div><div className="sub">need a person</div></div>
        <div className="k"><span className="lab">Paid, last 30 days</span><div className="v">{formatPeso(paid._sum.amount ?? 0)}</div><div className="sub">{paid._count} order{paid._count === 1 ? "" : "s"}</div></div>
        <div className="k"><span className="lab">Overdue filings</span><div className="v" style={{ color: overdue ? "var(--out)" : undefined }}>{overdue}</div><div className="sub">{newLeads} new lead{newLeads === 1 ? "" : "s"} this week</div></div>
      </div>

      <div className="two">
        <div className="sheet">
          <div className="hd"><div><span className="lab">Do next</span><h2>Consults to schedule</h2></div></div>
          <div className="bd flush">
            {toSchedule.length === 0 ? <div className="empty">Nobody is waiting.</div> : (
              <table><thead><tr><th>Client</th><th>Paid</th><th></th></tr></thead><tbody>
                {toSchedule.map((c) => (
                  <tr key={c.id}>
                    <td>{c.lead.businessName}<div className="id">{c.lead.name}</div></td>
                    <td>{dmy(c.createdAt)}</td>
                    <td className="r">{c.tenantId && <Link href={`/admin/clients/${c.tenantId}`}><button className="btn ghost" type="button" style={{ width: "auto", padding: "6px 11px" }}>Open</button></Link>}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>
        </div>

        <div className="sheet">
          <div className="hd"><div><span className="lab">Next up</span><h2>Scheduled consults</h2></div></div>
          <div className="bd flush">
            {upcoming.length === 0 ? <div className="empty">Nothing scheduled.</div> : (
              <table><thead><tr><th>When (Manila)</th><th>Client</th></tr></thead><tbody>
                {upcoming.map((c) => (
                  <tr key={c.id}><td>{c.scheduledFor ? formatManila(c.scheduledFor) : "-"}</td>
                    <td>{c.tenantId ? <Link href={`/admin/clients/${c.tenantId}`}>{c.lead.businessName}</Link> : c.lead.businessName}</td></tr>
                ))}
              </tbody></table>
            )}
          </div>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="sheet">
          <div className="hd"><div><span className="lab">Money may have moved</span><h2>Payments needing review</h2></div><Link href="/admin/payments"><button className="btn ghost" type="button" style={{ width: "auto" }}>See all</button></Link></div>
          <div className="bd flush"><table><thead><tr><th>Received</th><th>Event</th><th>Why</th></tr></thead><tbody>
            {reviews.map((e) => (<tr key={e.id}><td>{formatManila(e.receivedAt)}</td><td><span className="id">{e.providerEventId}</span></td><td><span className="tag bad">{(e.outcome ?? "").replace("needs_review:", "").replaceAll("_", " ")}</span></td></tr>))}
          </tbody></table></div>
        </div>
      )}
    </>
  );
}
