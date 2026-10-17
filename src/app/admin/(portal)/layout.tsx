import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Inbox, CreditCard, ShieldCheck } from "lucide-react";
import NavLink from "@/components/NavLink";
import { requireStaff } from "@/lib/firm/staff-auth";
import { BRAND } from "@/lib/firm/brand";
import { staffLogout } from "./actions";

export const metadata: Metadata = { title: "Staff portal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaff();
  const ic = { size: 17, strokeWidth: 2 };
  const items = [
    { href: "/admin", label: "Overview", icon: <LayoutDashboard {...ic} /> },
    { href: "/admin/clients", label: "Clients", icon: <Users {...ic} /> },
    { href: "/admin/leads", label: "Leads", icon: <Inbox {...ic} /> },
    { href: "/admin/payments", label: "Payments", icon: <CreditCard {...ic} /> },
    ...(staff.role === "ADMIN" ? [{ href: "/admin/staff", label: "Staff", icon: <ShieldCheck {...ic} /> }] : []),
  ];
  return (
    <div id="app" style={{ display: "block" }}>
      <div className="mobhead">
        <div className="n">{BRAND.name}</div>
        <form action={staffLogout}><button type="submit">Sign out</button></form>
      </div>
      <aside className="rail">
        <div className="brand">
          <div className="mark">{BRAND.name.charAt(0)}</div>
          <div className="txt"><div className="n">{BRAND.name}</div><div className="s">Staff portal</div></div>
        </div>
        <nav>{items.map((i) => <NavLink key={i.href} href={i.href} label={i.label} icon={i.icon} exact={i.href === "/admin"} />)}</nav>
        <div className="foot">
          <div className="chip">
            <div className="av">{staff.name.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}><div className="who">{staff.name}</div><div className="role">{staff.role}</div></div>
          </div>
          <form action={staffLogout}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
