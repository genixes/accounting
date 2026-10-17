import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "lead_session";
const AUDIENCE = "lead";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set.");
  return new TextEncoder().encode(s);
}

/** Remembers which lead is mid-funnel. Carries no authority beyond viewing their own result and paying. */
export async function setLeadSession(leadId: string) {
  const token = await new SignJWT({ leadId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 3600,
  });
}

export async function getLeadId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    return typeof payload.leadId === "string" ? payload.leadId : null;
  } catch {
    return null;
  }
}
