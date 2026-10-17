import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;

function pepper(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set.");
  return s;
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Keyed hash so a leaked table cannot be brute-forced offline without the secret. */
export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", pepper()).update(`otp:${email.toLowerCase()}:${code}`).digest("hex");
}

export function otpMatches(email: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOtp(email, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
