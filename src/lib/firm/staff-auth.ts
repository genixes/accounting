import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";

const COOKIE = "staff_session";
const HOURS = 8;
const AUDIENCE = "staff";

export type StaffRoleName = "ADMIN" | "PARTNER" | "SUPPORT";
export type StaffSession = { staffId: string; name: string; role: StaffRoleName };

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set.");
  return new TextEncoder().encode(s);
}

export async function createStaffSession(s: StaffSession) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE) // a tenant cookie can never be replayed as a staff cookie
    .setIssuedAt()
    .setExpirationTime(`${HOURS}h`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HOURS * 3600,
  });
}

export async function destroyStaffSession() {
  (await cookies()).delete(COOKIE);
}

/** Verified cookie, then re-checked against the DB so deactivating staff takes effect at once. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    const staff = await db.staffUser.findUnique({ where: { id: String(payload.staffId) } });
    if (!staff || !staff.active) return null;
    return { staffId: staff.id, name: staff.name, role: staff.role };
  } catch {
    return null;
  }
}

export async function requireStaff(allowed?: StaffRoleName[]): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) redirect("/admin/login");
  if (allowed && !allowed.includes(s.role)) redirect("/admin?denied=1");
  return s;
}
