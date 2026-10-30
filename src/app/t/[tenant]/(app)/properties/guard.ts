import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadTenant } from "@/lib/tenant";

/** Real-estate pages/actions: right tenant vertical, signed in, and a role
 *  that can see reports. `manage` additionally requires an Owner. */
export async function guard(slug: string, manage = false) {
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (tenant.vertical !== "REAL_ESTATE" || !session.perms.canReport) redirect(`/t/${slug}/ledger`);
  const canManage = session.perms.canManageUsers;
  if (manage && !canManage) redirect(`/t/${slug}/properties?err=${encodeURIComponent("Only an Owner can do that.")}`);
  return { tenant, session, canManage };
}

export const dateOf = (s: FormDataEntryValue | null) => {
  const v = String(s ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
};
export const numOf = (s: FormDataEntryValue | null) => {
  const v = String(s ?? "").replace(/,/g, "").trim();
  return v === "" ? null : Number(v);
};
export const strOf = (s: FormDataEntryValue | null) => String(s ?? "").trim();
