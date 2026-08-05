"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { addEntry, type WriteResult } from "@/lib/entries";
import type { RegisterKey } from "@/lib/roles";

export async function saveEntryAction(
  slug: string,
  regKey: RegisterKey,
  payload: Record<string, string>
): Promise<WriteResult> {
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const result = await addEntry(session, regKey, payload);
  if (result.ok) {
    revalidatePath(`/t/${slug}/dashboard`);
    revalidatePath(`/t/${slug}/ledger`);
    revalidatePath(`/t/${slug}/calendar`);
  }
  return result;
}
