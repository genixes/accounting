"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestOtp, verifyOtp } from "@/lib/firm/otp-service";
import { createSession } from "@/lib/auth";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; info?: string };

const Email = z.string().trim().max(254).email();

export async function clientLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") || "email");
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  if (intent === "email" || intent === "resend") {
    await requestOtp(email, "CLIENT");
    // Identical response whether or not the address has an account.
    return { step: "code", email, info: "If that address has a workspace, we have emailed a 6-digit code. It expires in 10 minutes." };
  }

  const result = await verifyOtp(email, "CLIENT", String(formData.get("code") || ""));
  if (!result.ok) return { step: "code", email, error: "That code is not valid. Check it, or request a new one." };

  const who = result.identities.find((i) => i.purpose === "CLIENT");
  if (!who || who.purpose !== "CLIENT") return { step: "code", email, error: "That code is not valid. Check it, or request a new one." };

  await createSession({ tenantId: who.tenantId, tenantSlug: who.tenantSlug, userId: who.userId, name: who.name, role: "Owner", projects: [] });
  redirect(`/t/${who.tenantSlug}/dashboard`);
}
