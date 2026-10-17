import "server-only";
import { db } from "@/lib/db";
import type { OtpPurpose } from "@prisma/client";
import { enqueueEmail, deliverSoon } from "./mailer";
import { otpEmail } from "./emails";
import { OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_TTL_MINUTES, generateOtp, hashOtp, normaliseEmail, otpMatches } from "./otp";

export type Identity =
  | { purpose: "CLIENT"; userId: string; tenantId: string; tenantSlug: string; name: string }
  | { purpose: "STAFF"; staffId: string; name: string; role: "ADMIN" | "PARTNER" | "SUPPORT" };

async function findIdentity(email: string, purpose: OtpPurpose): Promise<Identity[]> {
  if (purpose === "STAFF") {
    const s = await db.staffUser.findUnique({ where: { email } });
    return s?.active ? [{ purpose: "STAFF", staffId: s.id, name: s.name, role: s.role }] : [];
  }
  const users = await db.user.findMany({
    where: { email, active: true, tenant: { kind: "SELLER" } },
    include: { tenant: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });
  return users.map((u) => ({ purpose: "CLIENT", userId: u.id, tenantId: u.tenantId, tenantSlug: u.tenant.slug, name: u.name }));
}

/**
 * Always resolves the same way whether or not the email is known, so the form
 * cannot be used to discover who has an account. Throttled per email.
 */
export async function requestOtp(rawEmail: string, purpose: OtpPurpose): Promise<void> {
  const email = normaliseEmail(rawEmail);
  const recent = await db.otpChallenge.count({
    where: { email, purpose, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= OTP_MAX_PER_HOUR) return;
  if ((await findIdentity(email, purpose)).length === 0) return;

  const code = generateOtp();
  await db.$transaction(async (tx) => {
    // Only the newest code is valid.
    await tx.otpChallenge.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    await tx.otpChallenge.create({
      data: { email, purpose, codeHash: hashOtp(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000) },
    });
    await enqueueEmail(tx, { to: email, ...otpEmail(code, OTP_TTL_MINUTES) });
  });
  deliverSoon();
}

export type VerifyResult = { ok: true; identities: Identity[] } | { ok: false };

/** Single-use: the consume step is a conditional update, so two racing submits cannot both win. */
export async function verifyOtp(rawEmail: string, purpose: OtpPurpose, rawCode: string): Promise<VerifyResult> {
  const email = normaliseEmail(rawEmail);
  const code = rawCode.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) return { ok: false };

  const ch = await db.otpChallenge.findFirst({
    where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!ch || ch.attempts >= OTP_MAX_ATTEMPTS) return { ok: false };

  if (!otpMatches(email, code, ch.codeHash)) {
    await db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    return { ok: false };
  }
  const claimed = await db.otpChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (claimed.count !== 1) return { ok: false };

  const identities = await findIdentity(email, purpose);
  return identities.length ? { ok: true, identities } : { ok: false };
}
