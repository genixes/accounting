import { redirect } from "next/navigation";
import NavLink from "@/components/NavLink";
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

  const nav: { href: string; label: string; glyph: string }[] = [];
  if (session.perms.seeAllEntries) {
    nav.push({ href: "dashboard", label: "Dashboard", glyph: "▦" });
    nav.push({ href: "calendar", label: "Calendar", glyph: "▤" });
  }
  for (const r of availableRegisters) {
    nav.push({ href: `new/${r}`, label: `New ${REGISTERS[r].title}`, glyph: REGISTERS[r].glyph });
  }
  nav.push({ href: "ledger", label: "Ledger", glyph: "≡" });
  if (session.perms.canReport && tenant.features.reports) {
    nav.push({ href: "reports", label: "Reports", glyph: "▣" });
  }
  if (session.perms.canManageUsers && tenant.features.users) {
    nav.push({ href: "users", label: "Users", glyph: "○" });
  }

  const logout = logoutAction.bind(null, slug);

  return (
    <div id="app" style={{ display: "block" }}>
      <div className="mobhead">
        <div className="n">{session.name}</div>
        <form action={logout}><button type="submit">Sign out</button></form>
      </div>
      <aside className="rail">
        <div className="brand">
          {tenant.branding.logoUrl && (
            <div style={{ background: "#fff", padding: "7px 9px", borderRadius: 2, marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.branding.logoUrl} alt={tenant.branding.company} style={{ maxWidth: "100%", maxHeight: 54, display: "block" }} />
            </div>
          )}
          <div className="n">{tenant.branding.company || tenant.name}</div>
          <div className="s">Project Control</div>
        </div>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.href} href={`/t/${slug}/${item.href}`} glyph={item.glyph} label={item.label} />
          ))}
        </nav>
        <div className="foot">
          <div className="who">{session.name}</div>
          <div className="role">{session.role}</div>
          <form action={logout}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
