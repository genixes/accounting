import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { computeSignature } from "@/lib/firm/billing/signature";

export const hasDb = !!process.env.DATABASE_URL_TEST;
export const SECRET = process.env.PAYMONGO_WEBHOOK_SECRET!;

export async function resetDb() {
  // Child tables first; the test DB is disposable.
  await db.$executeRawUnsafe(
    `TRUNCATE "PaymentEvent","OtpChallenge","EmailOutbox","StaffAudit","StaffUser","Consult","Order","Lead","ComplianceDeadline","AuditLog","User","Tenant" RESTART IDENTITY CASCADE`
  );
}

export async function makeLead(over: Partial<{ email: string; businessName: string; name: string }> = {}) {
  const email = over.email ?? `buyer-${randomBytes(3).toString("hex")}@example.com`;
  return db.lead.create({
    data: {
      email,
      name: over.name ?? "Maria Santos",
      businessName: over.businessName ?? "Maria's Shop",
      consentAt: new Date(),
      consentVersion: "t",
      quizVersion: "t",
      answers: {},
      score: 50,
      planKey: "STARTER",
    },
  });
}

export async function makeOrder(leadId: string, amount = 150_000) {
  const ref = `ORD-${randomBytes(4).toString("hex").toUpperCase()}`;
  return db.order.create({
    data: { leadId, planKey: "STARTER", amount, referenceNumber: ref, providerRef: `cs_${randomBytes(4).toString("hex")}` },
  });
}

/** A PayMongo-shaped paid event plus a valid signature header for it. */
export function paidEvent(opts: { eventId?: string; reference: string; providerRef: string; amount: number | null; type?: string }) {
  const body = JSON.stringify({
    data: {
      id: opts.eventId ?? `evt_${randomBytes(4).toString("hex")}`,
      type: "event",
      attributes: {
        type: opts.type ?? "checkout_session.payment.paid",
        livemode: false,
        data: {
          id: opts.providerRef,
          type: "checkout_session",
          attributes: {
            reference_number: opts.reference,
            payments: opts.amount === null ? [] : [{ attributes: { amount: opts.amount, status: "paid" } }],
          },
        },
      },
    },
  });
  const t = String(Math.floor(Date.now() / 1000));
  return { body, header: `t=${t},te=${computeSignature(SECRET, t, body)},li=` };
}
