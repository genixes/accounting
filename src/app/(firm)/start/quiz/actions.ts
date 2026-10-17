"use server";

import { redirect } from "next/navigation";
import { LeadInput, saveLead } from "@/lib/firm/leads";
import { setLeadSession } from "@/lib/firm/lead-session";

export type QuizState = { error?: string };

export async function submitQuiz(_prev: QuizState, formData: FormData): Promise<QuizState> {
  let answers: unknown;
  try {
    answers = JSON.parse(String(formData.get("answers") || "{}"));
  } catch {
    return { error: "Something went wrong with your answers. Please go back and try again." };
  }

  const parsed = LeadInput.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    businessName: formData.get("businessName"),
    consent: formData.get("consent"),
    answers,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue.path[0] ?? "");
    const friendly: Record<string, string> = {
      name: "Enter your full name.",
      email: "Enter a valid email address.",
      businessName: "Enter your business or trade name.",
      consent: "Please accept the privacy notice to continue.",
      answers: "Please answer every question.",
    };
    return { error: friendly[field] ?? "Please check your details and try again." };
  }

  const lead = await saveLead(parsed.data);
  await setLeadSession(lead.id);
  redirect("/start/plan");
}
