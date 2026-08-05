import Link from "next/link";
import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { allLists } from "@/lib/lists";
import UserForm from "./UserForm";

export default async function UsersPage({
  params, searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.canManageUsers || !tenant.features.users) redirect(`/t/${slug}/dashboard`);

  const [users, lists] = await Promise.all([listUsers(session), allLists(tenant.id)]);
  const editing = sp.edit ? users.find((u) => u.name === sp.edit) || null : null;

  return (
    <div className="two">
      <div className="sheet">
        <div className="hd"><div><span className="lab">Who can sign in</span><h2>Users</h2></div></div>
        <div className="bd flush"><div className="scroll"><table>
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Projects</th><th></th></tr></thead>
          <tbody>
            {!users.length ? (
              <tr><td colSpan={5} className="empty">No users yet.</td></tr>
            ) : users.map((u) => (
              <tr key={u.name}>
                <td>{u.name}</td>
                <td>{u.role}</td>
                <td><span className={`tag ${u.active ? "go" : "void"}`}>{u.active ? "Active" : "Inactive"}</span></td>
                <td>{u.projects.join(", ") || "-"}</td>
                <td className="r"><Link href={`/t/${slug}/users?edit=${encodeURIComponent(u.name)}`}><button className="btn ghost" type="button" style={{ width: "auto", padding: "6px 11px" }}>Edit</button></Link></td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      </div>

      <div className="sheet">
        <div className="hd"><div><span className="lab">{editing ? `Editing ${editing.name}` : "New user"}</span><h2>{editing ? "Edit User" : "Add User"}</h2></div>
          {editing && <Link href={`/t/${slug}/users`}><button className="btn ghost" type="button" style={{ width: "auto" }}>New instead</button></Link>}
        </div>
        <div className="bd">
          <UserForm slug={slug} projects={lists.projects} editing={editing} />
        </div>
      </div>
    </div>
  );
}
