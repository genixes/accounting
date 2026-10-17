import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { requestOtp, verifyOtp } from "@/lib/firm/otp-service";
import { generateOtp, hashOtp } from "@/lib/firm/otp";
import { hasDb, resetDb } from "./helpers";

async function seedClient(email = "owner@shop.ph") {
  const t = await db.tenant.create({ data: { slug: "shop", name: "Shop", kind: "SELLER" } });
  await db.user.create({ data: { tenantId: t.id, name: "Owner", email, role: "Owner", pinHash: "x" } });
  return t;
}
/** Plant a known code, since the real one only exists in the (hashed) outbox. */
async function plant(email: string, purpose: "CLIENT" | "STAFF", code: string, over: Partial<{ expiresAt: Date }> = {}) {
  await db.otpChallenge.create({ data: { email, purpose, codeHash: hashOtp(email, code), expiresAt: over.expiresAt ?? new Date(Date.now() + 600_000) } });
}

describe.skipIf(!hasDb)("email OTP (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => db.$disconnect());

  it("does nothing, silently, for an unknown email (no enumeration)", async () => {
    await expect(requestOtp("nobody@x.com", "CLIENT")).resolves.toBeUndefined();
    expect(await db.otpChallenge.count()).toBe(0);
    expect(await db.emailOutbox.count()).toBe(0);
  });

  it("issues a code for a known client and queues one email", async () => {
    await seedClient();
    await requestOtp("Owner@Shop.PH", "CLIENT");
    expect(await db.otpChallenge.count()).toBe(1);
    const mail = await db.emailOutbox.findFirstOrThrow();
    expect(mail.to).toBe("owner@shop.ph");
    expect(mail.textBody).toMatch(/\b\d{6}\b/);
  });

  it("does not issue client codes to staff emails or vice versa", async () => {
    await db.staffUser.create({ data: { email: "cpa@firm.ph", name: "CPA", role: "PARTNER" } });
    await requestOtp("cpa@firm.ph", "CLIENT");
    expect(await db.otpChallenge.count()).toBe(0);
    await requestOtp("cpa@firm.ph", "STAFF");
    expect(await db.otpChallenge.count()).toBe(1);
  });

  it("verifies a correct code exactly once", async () => {
    const t = await seedClient();
    await plant("owner@shop.ph", "CLIENT", "123456");
    const first = await verifyOtp("owner@shop.ph", "CLIENT", "123 456");
    expect(first.ok && first.identities[0]).toMatchObject({ purpose: "CLIENT", tenantSlug: t.slug });
    expect((await verifyOtp("owner@shop.ph", "CLIENT", "123456")).ok).toBe(false);
  });

  it("two simultaneous correct submissions: only one wins", async () => {
    await seedClient();
    await plant("owner@shop.ph", "CLIENT", "654321");
    const rs = await Promise.all([verifyOtp("owner@shop.ph", "CLIENT", "654321"), verifyOtp("owner@shop.ph", "CLIENT", "654321")]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });

  it("locks the code after too many wrong attempts, even if the right one follows", async () => {
    await seedClient();
    await plant("owner@shop.ph", "CLIENT", "111111");
    for (let i = 0; i < 5; i++) expect((await verifyOtp("owner@shop.ph", "CLIENT", "000000")).ok).toBe(false);
    expect((await verifyOtp("owner@shop.ph", "CLIENT", "111111")).ok).toBe(false);
  });

  it("rejects expired codes and malformed input", async () => {
    await seedClient();
    await plant("owner@shop.ph", "CLIENT", "222222", { expiresAt: new Date(Date.now() - 1000) });
    expect((await verifyOtp("owner@shop.ph", "CLIENT", "222222")).ok).toBe(false);
    expect((await verifyOtp("owner@shop.ph", "CLIENT", "abc")).ok).toBe(false);
  });

  it("a newer code invalidates the older one", async () => {
    await seedClient();
    await requestOtp("owner@shop.ph", "CLIENT");
    await requestOtp("owner@shop.ph", "CLIENT");
    expect(await db.otpChallenge.count({ where: { consumedAt: null } })).toBe(1);
  });

  it("throttles requests per email per hour", async () => {
    await seedClient();
    for (let i = 0; i < 8; i++) await requestOtp("owner@shop.ph", "CLIENT");
    expect(await db.otpChallenge.count()).toBe(5);
  });

  it("does not accept a deactivated user", async () => {
    await seedClient();
    await db.user.updateMany({ data: { active: false } });
    await plant("owner@shop.ph", "CLIENT", "333333");
    expect((await verifyOtp("owner@shop.ph", "CLIENT", "333333")).ok).toBe(false);
  });
});

it("generateOtp is usable standalone", () => expect(generateOtp()).toHaveLength(6));
