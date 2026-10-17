"use server";

import { redirect } from "next/navigation";
import { getLeadId } from "@/lib/firm/lead-session";
import { isPlanKey } from "@/lib/firm/plans";
import { startCheckout } from "@/lib/firm/billing/service";
import { ProviderError } from "@/lib/firm/billing/provider";

export async function checkoutAction(planKey: string) {
  const leadId = await getLeadId();
  if (!leadId) redirect("/start/quiz");
  if (!isPlanKey(planKey)) redirect("/start/plan");

  let url: string;
  try {
    url = (await startCheckout(leadId, planKey)).checkoutUrl;
  } catch (e) {
    console.error("[checkout] failed:", e instanceof ProviderError ? e.message : (e as Error).message);
    redirect("/start/plan?error=payment");
  }
  redirect(url);
}
