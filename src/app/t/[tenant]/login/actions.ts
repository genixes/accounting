"use server";

import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { login } from "@/lib/login-service";

export type LoginState = { error?: string };

export async function loginAction(slug: string, _prev: LoginState, formData: FormData): Promise<LoginState> {
  const name = String(formData.get("name") || "").trim();
  const pin = String(formData.get("pin") || "").trim();
  if (!name || !pin) return { error: "Enter your name and PIN." };

  const tenant = await loadTenant(slug);
  const result = await login(tenant.id, tenant.slug, name, pin);
  if (!result.ok) return { error: result.error };

  redirect(`/t/${slug}/dashboard`);
}
