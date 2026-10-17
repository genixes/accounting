import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/firm/env";
import { formatPeso } from "@/lib/firm/plans";
import { simulatePaid } from "./actions";

export const dynamic = "force-dynamic";

export default async function MockPay({ params }: { params: Promise<{ ref: string }> }) {
  if (process.env.NODE_ENV === "production" || env().BILLING_PROVIDER !== "mock") notFound();
  const { ref } = await params;
  const order = await db.order.findUnique({ where: { referenceNumber: ref } });
  if (!order) notFound();

  return (
    <div className="narrow qwrap">
      <div className="ferr" style={{ color: "var(--ink)" }}>Development payment simulator. This page does not exist in production.</div>
      <h1 className="q">Pay {formatPeso(order.amount)}</h1>
      <p className="qhint">Order {order.referenceNumber} · status {order.status}</p>
      <form action={simulatePaid.bind(null, order.referenceNumber)}>
        <button className="fxb brass" type="submit">Simulate successful payment</button>
      </form>
    </div>
  );
}
