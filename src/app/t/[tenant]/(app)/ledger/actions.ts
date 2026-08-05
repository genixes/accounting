"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { voidEntry } from "@/lib/entries";
import type { RegisterKey } from "@/lib/roles";

export type VoidState = { error?: string };

export async function voidAction(
  slug: string,
  regKey: RegisterKey,
  entryId: string,
  _prev: VoidState,
  formData: FormData
): Promise<VoidState> {
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const reason = String(formData.get("reason") || "");
  const result = await voidEntry(session, regKey, entryId, reason);
  if (!result.ok) return { error: result.errors.join(" ") };

  revalidatePath(`/t/${slug}/ledger`);
  revalidatePath(`/t/${slug}/dashboard`);
  redirect(`/t/${slug}/ledger?voided=${entryId}`);
}
