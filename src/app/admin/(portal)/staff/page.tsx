import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { dmy } from "@/lib/format";
import { addStaff, setStaffActive } from "./actions";

const ERRORS: Record<string, string> = {
  invalid: "Enter a valid name, email and role.",
  exists: "That person is already active staff.",
  self: "You cannot deactivate yourself.",
  lastadmin: "There must always be at least one active admin.",
};

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ e?: string; ok?: string }> }) {
  const me = await requireStaff(["ADMIN"]);
  const sp = await searchParams;
  const staff = await db.staffUser.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
  return (
    <>
      <div className="pagehd"><div><h1>Staff</h1><div className="sub">Admins manage everything. Partners work with clients. Support can only look.</div></div></div>
      {sp.e && ERRORS[sp.e] && <div className="msg err show" role="alert" style={{ marginBottom: 18 }}>{ERRORS[sp.e]}</div>}
      {sp.ok && <div className="msg good show" style={{ marginBottom: 18 }}>Saved.</div>}
      <div className="sheet"><div className="bd flush"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th><th></th></tr></thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className={s.active ? "" : "voided"}>
              <td>{s.name}</td><td>{s.email}</td><td><span className="tag">{s.role.toLowerCase()}</span></td><td>{dmy(s.createdAt)}</td>
              <td className="r">{s.id !== me.staffId && (
                <form action={setStaffActive.bind(null, s.id, !s.active)}>
                  <button className="btn ghost" type="submit" style={{ width: "auto", padding: "6px 11px" }}>{s.active ? "Deactivate" : "Reactivate"}</button>
                </form>
              )}</td>
            </tr>
          ))}
        </tbody>
      </table></div></div>

      <div className="sheet"><div className="hd"><div><span className="lab">They sign in with an emailed code</span><h2>Add staff</h2></div></div>
        <form action={addStaff} className="bd">
          <div className="grid2">
            <div className="field"><label className="lab req" htmlFor="name">Name</label><input id="name" name="name" required minLength={2} maxLength={80} /></div>
            <div className="field"><label className="lab req" htmlFor="email">Work email</label><input id="email" name="email" type="email" required /></div>
          </div>
          <div className="field"><label className="lab req" htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="PARTNER"><option value="PARTNER">Partner accountant</option><option value="SUPPORT">Support (read only)</option><option value="ADMIN">Admin</option></select></div>
          <button className="btn" type="submit" style={{ width: "auto", padding: "12px 22px" }}>Add staff member</button>
        </form>
      </div>
    </>
  );
}
