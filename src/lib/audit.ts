import "server-only";
import type { Prisma } from "@prisma/client";

/** Ported from Code.gs audit_(). Written inside the same transaction as the
 *  write it records, so the log can never drift from what actually happened. */
export async function audit(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string | null,
  userName: string,
  role: string,
  action: string,
  register: string | null,
  entryId: string | null,
  details?: string
) {
  await tx.auditLog.create({
    data: {
      tenantId,
      userId,
      userName,
      role,
      action,
      register,
      entryId,
      details: (details || "").slice(0, 400),
    },
  });
}
