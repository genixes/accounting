"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { saveUser, type SaveUserResult } from "@/lib/users";

export async function saveUserAction(slug: string, _prev: SaveUserResult | null, formData: FormData): Promise<SaveUserResult> {
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);

  const result = await saveUser(session, {
    name: String(formData.get("name") || ""),
    role: String(formData.get("role") || ""),
    pin: String(formData.get("pin") || "").trim() || undefined,
    active: formData.get("active") === "1",
    projects: formData.getAll("projects").map(String),
  });

  if (result.ok) revalidatePath(`/t/${slug}/users`);
  return result;
}
