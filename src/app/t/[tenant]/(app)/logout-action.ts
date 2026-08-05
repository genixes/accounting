"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

export async function logoutAction(slug: string) {
  await destroySession(slug);
  redirect(`/t/${slug}/login`);
}
