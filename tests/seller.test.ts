import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { processPayMongoWebhook } from "@/lib/firm/billing/service";
import { addEntry, voidEntry } from "@/lib/entries";
import { permsFor } from "@/lib/roles";
import { registerFor } from "@/lib/vocab";
import { REGISTERS } from "@/lib/registers";
import type { Session } from "@/lib/auth";
import { hasDb, makeLead, makeOrder, paidEvent, resetDb } from "./helpers";

async function provisioned() {
  const lead = await makeLead({ businessName: "Seller One" });
  const order = await makeOrder(lead.id);
  const ev = paidEvent({ reference: order.referenceNumber, providerRef: order.providerRef!, amount: order.amount });
  await processPayMongoWebhook(ev.body, ev.header);
  const t = await db.tenant.findFirstOrThrow({ include: { users: true } });
  const u = t.users[0];
  const session: Session = { tenantId: t.id, tenantSlug: t.slug, userId: u.id, name: u.name, role: "Owner", projects: [], perms: permsFor("Owner") };
  return { t, session };
}

describe("registerFor", () => {
  it("leaves construction untouched", () => {
    expect(registerFor("CONSTRUCTION", "COLLECTION")).toBe(REGISTERS.COLLECTION);
  });
  it("relabels and drops project for sellers without mutating the shared config", () => {
    const sale = registerFor("SELLER", "COLLECTION");
    expect(sale.title).toBe("Sale");
    expect(sale.required).not.toContain("project");
    expect(sale.fields.some((f) => f.key === "project")).toBe(false);
    expect(sale.fields.find((f) => f.key === "ewt")?.label).toBe("Tax withheld");
    expect(REGISTERS.COLLECTION.title).toBe("Collection");
    expect(REGISTERS.COLLECTION.required).toContain("project");
  });
});

describe.skipIf(!hasDb)("seller workspace entries (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("an owner can record a sale and an expense without ever naming a project", async () => {
    const { t, session } = await provisioned();
    const sale = await addEntry(session, "COLLECTION", {
      date: "2026-10-03", particulars: "Order #123", billAmount: "1,250.50", ewt: "12.50",
      paymentMethod: "GCash", depositedTo: "GCash / e-wallet",
    });
    expect(sale).toMatchObject({ ok: true });
    const exp = await addEntry(session, "EXPENSES", {
      date: "2026-10-04", particulars: "Bubble mailers", category: "Packaging", amount: "300", paidFrom: "Cash on hand",
    });
    expect(exp).toMatchObject({ ok: true });
    const row = await db.collection.findFirstOrThrow({ where: { tenantId: t.id }, include: { project: true } });
    expect(row.project.name).toBe("General");
    expect(Number(row.billAmount)).toBe(1250.5);
  });

  it("ignores a client-supplied project and still validates everything else", async () => {
    const { session } = await provisioned();
    const r = await addEntry(session, "EXPENSES", {
      date: "2026-10-04", particulars: "x", category: "Not a category", amount: "300", paidFrom: "Cash on hand", project: "Hacked",
    });
    expect(r.ok).toBe(false);
    expect(await db.expense.count()).toBe(0);
    const ok = await addEntry(session, "EXPENSES", {
      date: "2026-10-04", particulars: "x", category: "Packaging", amount: "300", paidFrom: "Cash on hand", project: "Hacked",
    });
    expect(ok.ok).toBe(true);
    expect((await db.expense.findFirstOrThrow({ include: { project: true } })).project.name).toBe("General");
  });

  it("voiding keeps the row, and the audit trail records both actions", async () => {
    const { t, session } = await provisioned();
    const r = await addEntry(session, "EXPENSES", { date: "2026-10-04", particulars: "oops", category: "Other", amount: "10", paidFrom: "Bank account" });
    if (!r.ok) throw new Error("setup");
    expect(await voidEntry(session, "EXPENSES", r.id, "Entered twice by mistake")).toMatchObject({ ok: true });
    const row = await db.expense.findFirstOrThrow();
    expect(row.voidedAt).not.toBeNull();
    expect((await db.auditLog.findMany({ where: { tenantId: t.id }, orderBy: { at: "asc" } })).map((a) => a.action)).toEqual(["PROVISION", "ADD", "VOID"]);
  });

  it("entries are isolated between workspaces", async () => {
    const a = await provisioned();
    const lead2 = await makeLead({ businessName: "Seller Two", email: "two@x.com" });
    const o2 = await makeOrder(lead2.id);
    const ev2 = paidEvent({ reference: o2.referenceNumber, providerRef: o2.providerRef!, amount: o2.amount });
    await processPayMongoWebhook(ev2.body, ev2.header);
    await addEntry(a.session, "EXPENSES", { date: "2026-10-04", particulars: "mine", category: "Other", amount: "10", paidFrom: "Bank account" });
    const other = await db.tenant.findFirstOrThrow({ where: { slug: "seller-two" } });
    expect(await db.expense.count({ where: { tenantId: other.id } })).toBe(0);
  });
});
