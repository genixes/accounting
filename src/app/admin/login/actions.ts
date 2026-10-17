"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestOtp, verifyOtp } from "@/lib/firm/otp-service";
import { createStaffSession } from "@/lib/firm/staff-auth";

export type StaffLoginState = { step: "email" | "code"; email?: string; error?: string; info?: string };
const Email = z.string().trim().max(254).email();

export async function staffLogin(_prev: StaffLoginState, formData: FormData): Promise<StaffLoginState> {
  const intent = String(formData.get("intent") || "email");
  const parsed = Email.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  if (intent === "email" || intent === "resend") {
    await requestOtp(email, "STAFF");
    return { step: "code", email, info: "If that address belongs to staff, we have emailed a 6-digit code." };
  }

  const result = await verifyOtp(email, "STAFF", String(formData.get("code") || ""));
  const who = result.ok ? result.identities.find((i) => i.purpose === "STAFF") : undefined;
  if (!who || who.purpose !== "STAFF") return { step: "code", email, error: "That code is not valid. Check it, or request a new one." };

  await createStaffSession({ staffId: who.staffId, name: who.name, role: who.role });
  redirect("/admin");
}
