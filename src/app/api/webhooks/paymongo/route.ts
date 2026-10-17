import { NextResponse } from "next/server";
import { processPayMongoWebhook } from "@/lib/firm/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 200 = handled (including duplicates and items parked for review): stop retrying.
 * 400 = not authentic or unreadable: do not retry.
 * 500 = our fault, transient: the provider should retry.
 */
export async function POST(req: Request) {
  // Raw text, untouched: the signature covers these exact bytes.
  const raw = await req.text();
  try {
    const r = await processPayMongoWebhook(raw, req.headers.get("paymongo-signature"));
    return NextResponse.json({ received: r.http === 200, outcome: r.outcome }, { status: r.http });
  } catch (e) {
    console.error("[webhook:paymongo] processing failed:", (e as Error).message);
    return NextResponse.json({ received: false }, { status: 500 });
  }
}
