import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, CalendarDays, ListChecks, FileBarChart2, Users } from "lucide-react";
import NavLink from "@/components/NavLink";
import { REGISTER_ICON } from "@/components/register-icons";
import { loadTenant, type FeatureKey } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { REGISTERS } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";
import { logoutAction } from "./logout-action";

const REGISTER_FEATURE: Partial<Record<RegisterKey, FeatureKey>> = {
  PAYROLL: "payroll",
  COLLECTION: "collection",
  TRANSFERS: "transfers",
};

// Icon components can't cross the server->client boundary as props (only
// serializable data / rendered elements can) — so we render each icon to a
// plain element here, server-side, and hand NavLink the element, not the
// component reference.
type NavItem = { href: string; label: string; icon: ReactNode };
type NavGroup = { label?: string; items: NavItem[] };

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const availableRegisters = session.perms.add.filter((r) => {
    const feature = REGISTER_FEATURE[r];
    return !feature || tenant.features[feature];
  });

  const ic = (size = 17) => ({ size, strokeWidth: 2 });

  const groups: NavGroup[] = [];
  if (session.perms.seeAllEntries) {
    groups.push({
      items: [
        { href: "dashboard", label: "Dashboard", icon: <LayoutDashboard {...ic()} /> },
        { href: "calendar", label: "Calendar", icon: <CalendarDays {...ic()} /> },
      ],
    });
  }
  groups.push({
    label: "Accounting",
    items: [
      ...availableRegisters.map((r) => {
        const Icon = REGISTER_ICON[r];
        return { href: `new/${r}`, label: `New ${REGISTERS[r].title}`, icon: <Icon {...ic()} /> };
      }),
      { href: "ledger", label: "Ledger", icon: <ListChecks {...ic()} /> },
    ],
  });
  const admin: NavItem[] = [];
  if (session.perms.canReport && tenant.features.reports) admin.push({ href: "reports", label: "Reports", icon: <FileBarChart2 {...ic()} /> });
  if (session.perms.canManageUsers && tenant.features.users) admin.push({ href: "users", label: "Users", icon: <Users {...ic()} /> });
  if (admin.length) groups.push({ label: "Admin", items: admin });

  const logout = logoutAction.bind(null, slug);
  const initial = (tenant.branding.company || tenant.name || "?").trim().charAt(0).toUpperCase();
  const userInitial = (session.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div id="app" style={{ display: "block" }}>
      <div className="mobhead">
        <div className="n">{tenant.branding.company || tenant.name}</div>
        <form action={logout}><button type="submit">Sign out</button></form>
      </div>
      <aside className="rail">
        <div className="brand">
          {tenant.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.branding.logoUrl} alt={tenant.branding.company} className="mark" style={{ background: "#fff", padding: 4 }} />
          ) : (
            <div className="mark">{initial}</div>
          )}
          <div className="txt">
            <div className="n">{tenant.branding.company || tenant.name}</div>
            <div className="s">Project Control</div>
          </div>
        </div>
        <nav>
          {groups.map((group, i) => (
            <div key={group.label || `g${i}`}>
              {group.label && <div className="grp">{group.label}</div>}
              {group.items.map((item) => (
                <NavLink key={item.href} href={`/t/${slug}/${item.href}`} label={item.label} icon={item.icon} />
              ))}
            </div>
          ))}
        </nav>
        <div className="foot">
          <div className="chip">
            <div className="av">{userInitial}</div>
            <div style={{ minWidth: 0 }}>
              <div className="who">{session.name}</div>
              <div className="role">{session.role}</div>
            </div>
          </div>
          <form action={logout}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
