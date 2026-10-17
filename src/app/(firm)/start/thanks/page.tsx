import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "../../SiteHeader";
import AutoRefresh from "./AutoRefresh";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Payment" };
export const dynamic = "force-dynamic";

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  const order = ref ? await db.order.findUnique({ where: { referenceNumber: ref }, select: { status: true, referenceNumber: true } }) : null;

  return (
    <>
      <SiteHeader />
      <div className="narrow qwrap">
        {!order && (
          <>
            <h1 className="q">We could not find that payment.</h1>
            <p className="qhint">If you were charged, email us with the time of payment and we will sort it out.</p>
            <Link href="/start" className="fxb line">Back to start</Link>
          </>
        )}
        {order?.status === "PAID" && (
          <>
            <div className="qcount tn">Reference {order.referenceNumber}</div>
            <h1 className="q">Payment received. Your workspace is ready.</h1>
            <p className="qhint">We emailed you a sign-in link. A partner accountant will contact you to schedule your first consultation.</p>
            <Link href="/login" className="fxb brass">Sign in to your workspace</Link>
          </>
        )}
        {order && order.status !== "PAID" && (
          <>
            <AutoRefresh />
            <div className="qcount tn">Reference {order.referenceNumber}</div>
            <h1 className="q">Confirming your payment…</h1>
            <p className="qhint">This usually takes a few seconds. This page updates by itself. If you have already paid, you do not need to do anything else.</p>
          </>
        )}
      </div>
    </>
  );
}
