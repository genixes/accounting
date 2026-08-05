import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { permsFor, type RolePerms } from "@/lib/roles";

const SESSION_HOURS = 12;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set.");
  return new TextEncoder().encode(s);
}

export type SessionPayload = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  name: string;
  role: Role;
  /** Project names this user is limited to. Only meaningful for Foreman. */
  projects: string[];
};

export type Session = SessionPayload & { perms: RolePerms };

function cookieName(tenantSlug: string) {
  return `session_${tenantSlug}`;
}

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());

  const jar = await cookies();
  jar.set(cookieName(payload.tenantSlug), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession(tenantSlug: string) {
  const jar = await cookies();
  jar.delete(cookieName(tenantSlug));
}

/** Reads and verifies the session for a tenant. Null if absent/expired/invalid. */
export async function getSession(tenantSlug: string): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(cookieName(tenantSlug))?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const s = payload as unknown as SessionPayload;
    if (s.tenantSlug !== tenantSlug) return null;
    return { ...s, perms: permsFor(s.role) };
  } catch {
    return null;
  }
}
