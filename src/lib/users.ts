import "server-only";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/roles";
import { hashPin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import type { Role } from "@prisma/client";

export type SaveUserInput = {
  name: string;
  role: string;
  pin?: string;
  active: boolean;
  projects: string[];
};

export type SaveUserResult = { ok: true } | { ok: false; errors: string[] };

/** Ported from Code.gs saveUser(). Upserts by name within the tenant. */
export async function saveUser(session: Session, input: SaveUserInput): Promise<SaveUserResult> {
  if (!session.perms.canManageUsers) {
    return { ok: false, errors: ["Only the Owner can manage users."] };
  }
  if (!input.name?.trim() || !input.role) {
    return { ok: false, errors: ["Name and role are required."] };
  }
  if (!ROLES[input.role as Role]) {
    return { ok: false, errors: [`Role must be one of: ${Object.keys(ROLES).join(", ")}`] };
  }
  if (input.pin && !/^\d{4,8}$/.test(input.pin)) {
    return { ok: false, errors: ["PIN must be 4 to 8 digits."] };
  }

  const name = input.name.trim();
  const existing = await db.user.findUnique({ where: { tenantId_name: { tenantId: session.tenantId, name } } });
  if (!existing && !input.pin) {
    return { ok: false, errors: ["A PIN is required for a new user."] };
  }

  const projects = input.projects.length
    ? await db.project.findMany({ where: { tenantId: session.tenantId, name: { in: input.projects } }, select: { id: true } })
    : [];

  await db.$transaction(async (tx) => {
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            role: input.role as Role,
            active: input.active,
            ...(input.pin ? { pinHash: await hashPin(input.pin) } : {}),
          },
        })
      : await tx.user.create({
          data: {
            tenantId: session.tenantId,
            name,
            role: input.role as Role,
            active: input.active,
            pinHash: await hashPin(input.pin!),
          },
        });

    await tx.userProject.deleteMany({ where: { userId: user.id } });
    if (projects.length) {
      await tx.userProject.createMany({ data: projects.map((p) => ({ userId: user.id, projectId: p.id })) });
    }

    await audit(
      tx, session.tenantId, session.userId, session.name, session.role,
      existing ? "USER_EDIT" : "USER_ADD", "USERS", name,
      `${input.role}${input.pin ? " (PIN reset)" : ""}`
    );
  });

  return { ok: true };
}

export async function listUsers(session: Session) {
  if (!session.perms.canManageUsers) {
    throw new Error("Only the Owner can manage users.");
  }
  const users = await db.user.findMany({
    where: { tenantId: session.tenantId },
    include: { projects: { include: { project: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    name: u.name,
    role: u.role,
    active: u.active,
    projects: u.projects.map((p) => p.project.name),
  }));
}
