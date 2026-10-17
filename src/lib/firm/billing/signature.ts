import { createHmac, timingSafeEqual } from "node:crypto";

export type SignatureMode = "test" | "live";

type Parsed = { t: string; te?: string; li?: string };

/** Header looks like: `t=1496734173,te=<hex>,li=<hex>` (either of te/li may be empty). */
export function parseSignatureHeader(header: string | null | undefined): Parsed | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv.length >= 2)
      .map(([k, ...v]) => [k, v.join("=")])
  );
  if (!parts.t) return null;
  return { t: parts.t, te: parts.te || undefined, li: parts.li || undefined };
}

export function computeSignature(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * Verifies the HMAC over the *raw* request body. The caller must pass the
 * exact bytes received — re-serialising parsed JSON would change them.
 * Replay protection is the PaymentEvent unique key, not a clock window, so a
 * legitimately delayed provider retry is never rejected.
 */
export function verifySignature(opts: {
  secret: string;
  header: string | null | undefined;
  rawBody: string;
  mode: SignatureMode;
}): boolean {
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return false;
  const provided = opts.mode === "live" ? parsed.li : parsed.te;
  if (!provided || !/^[0-9a-f]+$/i.test(provided)) return false;
  const expected = Buffer.from(computeSignature(opts.secret, parsed.t, opts.rawBody), "hex");
  const got = Buffer.from(provided, "hex");
  return expected.length === got.length && timingSafeEqual(expected, got);
}
