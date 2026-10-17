import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/firm/staff-auth";
import { BRAND } from "@/lib/firm/brand";
import StaffLoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function StaffLoginPage() {
  if (await getStaffSession()) redirect("/admin");
  return (
    <div id="login">
      <div className="box">
        <div className="plate">
          <div className="mark" style={{ width: 44, height: 44, borderRadius: 12, marginBottom: 16, fontSize: 18 }}>{BRAND.name.charAt(0)}</div>
          <div className="t">{BRAND.name}</div>
          <div className="s">Staff portal</div>
        </div>
        <div className="card"><StaffLoginForm /></div>
      </div>
    </div>
  );
}
