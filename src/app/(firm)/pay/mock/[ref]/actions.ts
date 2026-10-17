"use server";

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/firm/env";
import { processVerifiedEvent } from "@/lib/firm/billing/service";

/** Builds the same event PayMongo would send and runs it through the real handler. */
export async function simulatePaid(reference: string) {
  if (process.env.NODE_ENV === "production" || env().BILLING_PROVIDER !== "mock") notFound();
  const order = await db.order.findUnique({ where: { referenceNumber: reference } });
  if (!order) notFound();

  const body = JSON.stringify({
    data: {
      id: `evt_mock_${order.referenceNumber}`,
      type: "event",
      attributes: {
        type: "checkout_session.payment.paid",
        livemode: false,
        data: {
          id: order.providerRef,
          type: "checkout_session",
          attributes: { reference_number: order.referenceNumber, payments: [{ attributes: { amount: order.amount, status: "paid" } }] },
        },
      },
    },
  });
  await processVerifiedEvent("mock", body);
  redirect(`/start/thanks?ref=${encodeURIComponent(order.referenceNumber)}`);
}
