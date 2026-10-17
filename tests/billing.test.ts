import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { processPayMongoWebhook } from "@/lib/firm/billing/service";
import { hasDb, makeLead, makeOrder, paidEvent, resetDb } from "./helpers";

describe.skipIf(!hasDb)("payment webhook (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("rejects a bad signature and touches nothing", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
    const r = await processPayMongoWebhook(ev.body, "t=1,te=deadbeef,li=");
    expect(r).toEqual({ http: 400, outcome: "bad_signature" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await db.paymentEvent.count()).toBe(0);
    expect(await db.tenant.count()).toBe(0);
  });

  it("on a valid paid event: marks paid, provisions a seller workspace, queues emails, requests a consult", async () => {
    const lead = await makeLead({ businessName: "Maria's Shop" });
    const order = await makeOrder(lead.id);
    const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });

    const r = await processPayMongoWebhook(ev.body, ev.header);
    expect(r.http).toBe(200);

    const paid = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { tenant: { include: { features: true, accounts: true, projects: true, users: true, listItems: true, branding: true } } } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAt).not.toBeNull();
    const t = paid.tenant!;
    expect(t.kind).toBe("SELLER");
    expect(t.slug).toBe("maria-s-shop");
    expect(t.branding?.company).toBe("Maria's Shop");
    expect(t.projects.map((p) => p.name)).toEqual(["General"]);
    expect(t.accounts.length).toBe(3);
    expect(t.listItems.some((i) => i.type === "category" && i.value === "Platform fees")).toBe(true);
    expect(t.features.filter((f) => !f.enabled).map((f) => f.key).sort()).toEqual(["payroll", "reports", "transfers", "users"]);
    expect(t.users).toHaveLength(1);
    expect(t.users[0]).toMatchObject({ role: "Owner", email: lead.email, active: true });
    expect(await db.consult.count({ where: { tenantId: t.id, status: "REQUESTED" } })).toBe(1);
    expect(await db.emailOutbox.count()).toBe(2);
    expect(await db.auditLog.count({ where: { tenantId: t.id, action: "PROVISION" } })).toBe(1);
  });

  it("is idempotent: the same event delivered 5 times, concurrently, provisions exactly once", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const ev = paidEvent({ eventId: "evt_same", reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
    const results = await Promise.all(Array.from({ length: 5 }, () => processPayMongoWebhook(ev.body, ev.header).catch((e) => ({ http: 500 as const, outcome: String(e) }))));

    expect(await db.tenant.count()).toBe(1);
    expect(await db.consult.count()).toBe(1);
    expect(await db.emailOutbox.count()).toBe(2);
    expect(await db.paymentEvent.count()).toBe(1);
    // Every delivery either did the work or was recognised as a duplicate; none created extras.
    for (const r of results) expect(["200", "500"]).toContain(String(r.http));
    expect(results.some((r) => r.http === 200)).toBe(true);

    // A later redelivery is a clean no-op.
    const again = await processPayMongoWebhook(ev.body, ev.header);
    expect(again).toEqual({ http: 200, outcome: "duplicate" });
  });

  it("a different event id for an already-paid order does not provision twice", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const a = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
    const b = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
    await processPayMongoWebhook(a.body, a.header);
    const r = await processPayMongoWebhook(b.body, b.header);
    expect(r).toEqual({ http: 200, outcome: "already_paid" });
    expect(await db.tenant.count()).toBe(1);
  });

  it("flags an amount mismatch for review and does not provision", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id, 150_000);
    const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: 100 });
    const r = await processPayMongoWebhook(ev.body, ev.header);
    expect(r).toEqual({ http: 200, outcome: "needs_review:amount_mismatch" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
    expect(await db.tenant.count()).toBe(0);
    expect((await db.paymentEvent.findFirstOrThrow()).outcome).toBe("needs_review:amount_mismatch");
  });

  it("flags unknown amount and unknown order for review", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const noAmount = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: null });
    expect((await processPayMongoWebhook(noAmount.body, noAmount.header)).outcome).toBe("needs_review:amount_unknown");
    const ghost = paidEvent({ reference: "ORD-NOPE", providerRef: "cs_nope", amount: 1 });
    expect((await processPayMongoWebhook(ghost.body, ghost.header)).outcome).toBe("needs_review:order_not_found");
    expect(await db.tenant.count()).toBe(0);
  });

  it("ignores other event types but records them", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount, type: "payment.failed" });
    expect((await processPayMongoWebhook(ev.body, ev.header)).outcome).toBe("ignored:payment.failed");
    expect(await db.tenant.count()).toBe(0);
    expect(await db.paymentEvent.count()).toBe(1);
  });

  it("finishes an event that was stored but never processed (crash recovery)", async () => {
    const lead = await makeLead();
    const order = await makeOrder(lead.id);
    const ev = paidEvent({ eventId: "evt_crash", reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
    await db.paymentEvent.create({ data: { provider: "paymongo", providerEventId: "evt_crash", type: "checkout_session.payment.paid", payload: JSON.parse(ev.body) } });
    const r = await processPayMongoWebhook(ev.body, ev.header);
    expect(r.outcome).toMatch(/^provisioned:/);
    expect(await db.tenant.count()).toBe(1);
  });

  it("allocates a unique slug when two clients share a business name", async () => {
    for (const email of ["a@x.com", "b@x.com"]) {
      const lead = await makeLead({ email, businessName: "Same Name" });
      const order = await makeOrder(lead.id);
      const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
      await processPayMongoWebhook(ev.body, ev.header);
    }
    expect((await db.tenant.findMany({ orderBy: { createdAt: "asc" } })).map((t) => t.slug)).toEqual(["same-name", "same-name-2"]);
  });

  it("rejects malformed payloads even when correctly signed", async () => {
    const body = JSON.stringify({ hello: "world" });
    const { computeSignature } = await import("@/lib/firm/billing/signature");
    const t = "1";
    const r = await processPayMongoWebhook(body, `t=${t},te=${computeSignature(process.env.PAYMONGO_WEBHOOK_SECRET!, t, body)}`);
    expect(r).toEqual({ http: 400, outcome: "bad_payload" });
  });
});
