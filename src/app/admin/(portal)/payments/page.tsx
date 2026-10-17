import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { formatPeso } from "@/lib/firm/plans";
import { formatManila } from "@/lib/firm/staff";

const TONE: Record<string, string> = { PAID: "go", PENDING: "hold", FAILED: "bad", EXPIRED: "void" };

export default async function PaymentsPage() {
  await requireStaff();
  const [orders, events] = await Promise.all([
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { lead: { select: { businessName: true, email: true } } } }),
    db.paymentEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 100 }),
  ]);
  return (
    <>
      <div className="pagehd"><div><h1>Payments</h1><div className="sub">Orders, and every message received from the payment provider.</div></div></div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Latest 100</span><h2>Orders</h2></div></div>
        <div className="bd flush"><div className="scroll">
          {orders.length === 0 ? <div className="empty">No orders yet.</div> : (
            <table><thead><tr><th>Created</th><th>Reference</th><th>Client</th><th>Plan</th><th className="r">Amount</th><th>Status</th></tr></thead><tbody>
              {orders.map((o) => (
                <tr key={o.id}><td>{formatManila(o.createdAt)}</td><td><span className="id">{o.referenceNumber}</span></td>
                  <td>{o.lead.businessName}<div className="id">{o.lead.email}</div></td><td>{o.planKey}</td>
                  <td className="r num">{formatPeso(o.amount)}</td><td><span className={`tag ${TONE[o.status] ?? ""}`}>{o.status}</span></td></tr>
              ))}
            </tbody></table>
          )}
        </div></div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Audit record</span><h2>Provider events</h2></div></div>
        <div className="bd flush"><div className="scroll">
          {events.length === 0 ? <div className="empty">No events received.</div> : (
            <table><thead><tr><th>Received</th><th>Event</th><th>Type</th><th>Outcome</th></tr></thead><tbody>
              {events.map((e) => {
                const review = e.outcome?.startsWith("needs_review");
                return (
                  <tr key={e.id}><td>{formatManila(e.receivedAt)}</td><td><span className="id">{e.providerEventId}</span></td><td>{e.type}</td>
                    <td>{!e.processedAt ? <span className="tag hold">Not finished</span> : <span className={`tag ${review ? "bad" : "go"}`}>{(e.outcome ?? "").replaceAll("_", " ")}</span>}</td></tr>
                );
              })}
            </tbody></table>
          )}
        </div></div>
      </div>
    </>
  );
}
