import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "../env";
import { BRAND } from "../brand";
import { PLANS, isPlanKey, type PlanKey } from "../plans";
import { enqueueEmail, deliverSoon } from "../mailer";
import { staffNewClientEmail, welcomeEmail } from "../emails";
import { provisionSeller } from "../provisioning";
import { getProvider } from "./index";
import { parsePayMongoEvent, PAID_EVENT_TYPES } from "./paymongo";
import { verifySignature } from "./signature";
import type { PaidEvent } from "./provider";

// ---------------------------------------------------------------------------
// Creating a checkout
// ---------------------------------------------------------------------------

/**
 * Starts (or resumes) a checkout. Double-clicking "Pay" must not create two
 * orders: an unexpired PENDING order for the same lead+plan is reused.
 */
export async function startCheckout(leadId: string, planKey: PlanKey): Promise<{ checkoutUrl: string; orderId: string }> {
  if (!isPlanKey(planKey)) throw new Error("Unknown plan.");
  const plan = PLANS[planKey];
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });

  const now = new Date();
  let order = await db.order.findFirst({
    where: { leadId, planKey, status: "PENDING", checkoutUrl: { not: null }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
  });
  if (order?.checkoutUrl) return { checkoutUrl: order.checkoutUrl, orderId: order.id };

  // A PENDING order without a checkout URL means a previous provider call failed; reuse it.
  order =
    (await db.order.findFirst({ where: { leadId, planKey, status: "PENDING", checkoutUrl: null }, orderBy: { createdAt: "desc" } })) ??
    (await db.order.create({
      data: { leadId, planKey, amount: plan.amount, referenceNumber: `ORD-${randomBytes(6).toString("hex").toUpperCase()}` },
    }));

  const appUrl = env().APP_URL;
  const session = await getProvider().createCheckout({
    reference: order.referenceNumber,
    amount: order.amount,
    description: `${BRAND.name} — ${plan.name}`,
    customerName: lead.name,
    customerEmail: lead.email,
    successUrl: `${appUrl}/start/thanks?ref=${encodeURIComponent(order.referenceNumber)}`,
    cancelUrl: `${appUrl}/start/plan?cancelled=1`,
  });

  await db.order.update({
    where: { id: order.id },
    data: { providerRef: session.providerRef, checkoutUrl: session.checkoutUrl, expiresAt: session.expiresAt },
  });
  return { checkoutUrl: session.checkoutUrl, orderId: order.id };
}

// ---------------------------------------------------------------------------
// Webhook processing
// ---------------------------------------------------------------------------

export type WebhookOutcome =
  | { http: 200; outcome: string }
  | { http: 400; outcome: "bad_signature" | "bad_payload" };

/**
 * Entry point for provider webhooks. Properties this guarantees:
 *  - authenticity: HMAC over the raw body must verify, or nothing is touched;
 *  - idempotency: the same event delivered N times has the effect of one;
 *  - crash safety: an event stored but never finished is finished on redelivery;
 *  - no silent loss: anything we cannot safely act on is recorded as
 *    `needs_review:*` for a human, never dropped and never auto-provisioned.
 */
export async function processPayMongoWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookOutcome> {
  const cfg = env();
  const secret = cfg.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !verifySignature({ secret, header: signatureHeader, rawBody, mode: cfg.PAYMONGO_MODE })) {
    return { http: 400, outcome: "bad_signature" };
  }
  return processVerifiedEvent("paymongo", rawBody);
}

/** Shared by the real webhook and the mock provider's simulator (post-verification). */
export async function processVerifiedEvent(provider: string, rawBody: string): Promise<WebhookOutcome> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { http: 400, outcome: "bad_payload" };
  }
  const event = parsePayMongoEvent(json);
  if (!event) return { http: 400, outcome: "bad_payload" };

  try {
    await db.paymentEvent.create({
      data: { provider, providerEventId: event.eventId, type: event.type, payload: json as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    const prior = await db.paymentEvent.findUnique({ where: { provider_providerEventId: { provider, providerEventId: event.eventId } } });
    if (prior?.processedAt) return { http: 200, outcome: "duplicate" };
    // Stored but never finished (crash mid-way): fall through and finish it.
  }

  const outcome = PAID_EVENT_TYPES.has(event.type) ? await applyPaid(event) : `ignored:${event.type}`;
  await db.paymentEvent.update({
    where: { provider_providerEventId: { provider, providerEventId: event.eventId } },
    data: { processedAt: new Date(), outcome },
  });
  return { http: 200, outcome };
}

async function applyPaid(event: PaidEvent): Promise<string> {
  const order = await db.order.findFirst({
    where: {
      OR: [
        ...(event.reference ? [{ referenceNumber: event.reference }] : []),
        ...(event.providerRef ? [{ providerRef: event.providerRef }] : []),
      ],
    },
    include: { lead: true },
  });
  if (!order) return "needs_review:order_not_found";
  if (event.paidAmount === null) return "needs_review:amount_unknown";
  if (event.paidAmount !== order.amount) return "needs_review:amount_mismatch";

  const result = await db.$transaction(
    async (tx) => {
      // Serialise concurrent deliveries for this order.
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
      if (fresh.status === "PAID") return "already_paid";

      const { tenantId, slug } = await provisionSeller(tx, order.lead, order.id);
      await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), tenantId } });
      await tx.consult.create({ data: { leadId: order.leadId, tenantId } });

      const appUrl = env().APP_URL;
      const plan = PLANS[order.planKey as PlanKey];
      await enqueueEmail(tx, {
        to: order.lead.email,
        dedupeKey: `welcome:${order.id}`,
        ...welcomeEmail({ name: order.lead.name, business: order.lead.businessName, loginUrl: `${appUrl}/login` }),
      });
      await enqueueEmail(tx, {
        to: BRAND.supportEmail,
        dedupeKey: `staff-new-client:${order.id}`,
        ...staffNewClientEmail({ business: order.lead.businessName, plan: plan?.name ?? order.planKey, adminUrl: `${appUrl}/admin/clients` }),
      });
      return `provisioned:${slug}`;
    },
    { timeout: 30_000 }
  );

  if (result.startsWith("provisioned")) deliverSoon();
  return result;
}
