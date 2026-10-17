import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { canWrite, formatManila } from "@/lib/firm/staff";
import { classifyDeadline } from "@/lib/firm/deadlines";
import { PLANS, formatPeso, isPlanKey } from "@/lib/firm/plans";
import { dmy } from "@/lib/format";
import { addDeadline, deleteDeadline, scheduleConsult, toggleDeadline } from "./actions";

const ERRORS: Record<string, string> = {
  when: "Enter a valid date and time.",
  past: "That time has already passed.",
  url: "The meeting link must start with https://",
  consult: "That item no longer exists.",
  title: "Give the filing a title of at least 3 characters.",
  date: "Enter a valid due date.",
};

export default async function ClientDetail({
  params, searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ e?: string; ok?: string }>;
}) {
  const staff = await requireStaff();
  const { tenantId } = await params;
  const sp = await searchParams;

  const t = await db.tenant.findFirst({
    where: { id: tenantId, kind: "SELLER" },
    include: {
      order: { include: { lead: true } },
      consults: { orderBy: { createdAt: "desc" }, include: { assignedTo: true } },
      deadlines: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      users: { select: { name: true, email: true, role: true, active: true } },
    },
  });
  if (!t) notFound();

  const write = canWrite(staff.role);
  const lead = t.order?.lead;
  const now = new Date();
  const error = sp.e ? ERRORS[sp.e] : undefined;

  return (
    <>
      <div className="pagehd">
        <div>
          <div className="lab" style={{ marginBottom: 6 }}><Link href="/admin/clients">Clients</Link> /</div>
          <h1>{t.name}</h1>
          <div className="sub">Workspace /t/{t.slug} &middot; joined {dmy(t.createdAt)}</div>
        </div>
      </div>
      {error && <div className="msg err show" role="alert" style={{ marginBottom: 18 }}>{error}</div>}
      {sp.ok && <div className="msg good show" style={{ marginBottom: 18 }}>Saved.</div>}

      <div className="two">
        <div className="sheet">
          <div className="hd"><div><span className="lab">Who</span><h2>Client</h2></div></div>
          <div className="bd">
            <dl className="review">
              <dt className="lab">Name</dt><dd>{lead?.name}</dd>
              <dt className="lab" style={{ marginTop: 12 }}>Email</dt><dd>{lead?.email}</dd>
              {lead?.phone && <><dt className="lab" style={{ marginTop: 12 }}>Mobile</dt><dd>{lead.phone}</dd></>}
              <dt className="lab" style={{ marginTop: 12 }}>Plan</dt>
              <dd>{t.order && isPlanKey(t.order.planKey) ? `${PLANS[t.order.planKey].name} · ${formatPeso(t.order.amount)}` : "-"}</dd>
              <dt className="lab" style={{ marginTop: 12 }}>Readiness score</dt><dd>{lead?.score ?? "-"} / 100</dd>
            </dl>
          </div>
        </div>

        <div className="sheet">
          <div className="hd"><div><span className="lab">Meeting</span><h2>Consultation</h2></div></div>
          <div className="bd">
            {t.consults.length === 0 && <div className="empty">No consultation on record.</div>}
            {t.consults.map((c) => (
              <div key={c.id} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <span className={`tag ${c.status === "SCHEDULED" ? "go" : c.status === "REQUESTED" ? "hold" : ""}`}>{c.status.toLowerCase()}</span>
                  {c.scheduledFor && <span>{formatManila(c.scheduledFor)}</span>}
                </div>
                {c.meetUrl && <div className="id" style={{ marginBottom: 6 }}><a href={c.meetUrl} rel="noopener noreferrer" target="_blank">{c.meetUrl}</a></div>}
                {c.assignedTo && <div className="id">With {c.assignedTo.name}</div>}
                {write && (c.status === "REQUESTED" || c.status === "SCHEDULED") && (
                  <form action={scheduleConsult.bind(null, t.id, c.id)} style={{ marginTop: 14 }}>
                    <div className="field"><label className="lab req" htmlFor={`w${c.id}`}>Date and time (Manila)</label><input id={`w${c.id}`} name="when" type="datetime-local" required /></div>
                    <div className="field"><label className="lab req" htmlFor={`m${c.id}`}>Video call link</label><input id={`m${c.id}`} name="meetUrl" type="url" placeholder="https://meet.google.com/…" required /></div>
                    <button className="btn" type="submit">{c.status === "SCHEDULED" ? "Reschedule and email client" : "Schedule and email client"}</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">Seen by the client under Filing dates</span><h2>Filing calendar</h2></div></div>
        <div className="bd flush"><div className="scroll">
          {t.deadlines.length === 0 ? <div className="empty">No filing dates yet. Add the ones your accountant has confirmed.</div> : (
            <table>
              <thead><tr><th>Due</th><th>What</th><th>Status</th>{write && <th></th>}</tr></thead>
              <tbody>
                {t.deadlines.map((d) => {
                  const st = classifyDeadline(d, now);
                  return (
                    <tr key={d.id} className={st.key === "done" ? "voided" : ""}>
                      <td>{dmy(d.dueDate)}</td>
                      <td>{d.title}{d.notes && <div className="id">{d.notes}</div>}</td>
                      <td><span className={`tag ${st.tone}`}>{st.label}</span></td>
                      {write && (
                        <td className="r" style={{ whiteSpace: "nowrap" }}>
                          <form action={toggleDeadline.bind(null, t.id, d.id)} style={{ display: "inline" }}>
                            <button className="btn ghost" type="submit" style={{ width: "auto", padding: "6px 11px" }}>{d.status === "OPEN" ? "Mark done" : "Reopen"}</button>
                          </form>{" "}
                          <form action={deleteDeadline.bind(null, t.id, d.id)} style={{ display: "inline" }}>
                            <button className="btn ghost" type="submit" style={{ width: "auto", padding: "6px 11px" }}>Remove</button>
                          </form>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div></div>
        {write && (
          <form action={addDeadline.bind(null, t.id)} className="bd" style={{ borderTop: "1px solid var(--rule)" }}>
            <div className="grid2">
              <div className="field"><label className="lab req" htmlFor="title">What is due</label><input id="title" name="title" required minLength={3} maxLength={120} /></div>
              <div className="field"><label className="lab req" htmlFor="dueDate">Due date</label><input id="dueDate" name="dueDate" type="date" required /></div>
            </div>
            <div className="field"><label className="lab" htmlFor="notes">Note for the client (optional)</label><input id="notes" name="notes" maxLength={300} /></div>
            <button className="btn" type="submit" style={{ width: "auto", padding: "12px 22px" }}>Add filing date</button>
          </form>
        )}
      </div>
    </>
  );
}
