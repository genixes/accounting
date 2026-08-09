import "server-only";
import { db } from "@/lib/db";
import { hashPin, verifyPin, createSession, type SessionPayload } from "@/lib/auth";
import { permsFor } from "@/lib/roles";

export type LoginResult =
  | { ok: true; role: string; name: string }
  | { ok: false; error: string };

/**
 * Ported from Code.gs login(). PINs are stored bcrypt-hashed from the moment
 * a user is created (unlike the old sheet, there is no plain-text seed PIN
 * to upgrade in place here).
 */
export async function login(tenantId: string, tenantSlug: string, name: string, pin: string): Promise<LoginResult> {
  const user = await db.user.findUnique({
    where: { tenantId_name: { tenantId, name: name.trim() } },
    include: { projects: { include: { project: { select: { name: true } } } } },
  });
  if (!user) return { ok: false, error: "No user by that name." };
  if (!user.active) return { ok: false, error: "That account is not active." };

  const ok = await verifyPin(pin, user.pinHash);
  if (!ok) return { ok: false, error: "Wrong PIN." };

  const payload: SessionPayload = {
    tenantId,
    tenantSlug,
    userId: user.id,
    name: user.name,
    role: user.role,
    projects: user.projects.map((p) => p.project.name),
  };
  await createSession(payload);

  return { ok: true, role: user.role, name: user.name };
}

export { hashPin };
export const rolePerms = permsFor;
