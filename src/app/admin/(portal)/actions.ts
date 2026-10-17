"use server";

import { redirect } from "next/navigation";
import { destroyStaffSession } from "@/lib/firm/staff-auth";

export async function staffLogout() {
  await destroyStaffSession();
  redirect("/admin/login");
}
