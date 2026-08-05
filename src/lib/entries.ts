import "server-only";
import { db } from "@/lib/db";
import { nextEntryId } from "@/lib/registers";
import { validateEntry } from "@/lib/validate";
import { allLists } from "@/lib/lists";
import { audit } from "@/lib/audit";
import type { RegisterKey } from "@/lib/roles";
import type { Session } from "@/lib/auth";

export type WriteResult = { ok: true; id: string } | { ok: false; errors: string[] };

const REGISTERS_WITH_PROJECT: RegisterKey[] = ["EXPENSES", "PAYROLL", "COLLECTION"];

/**
 * The one place anything is written to a register. Ported from Code.gs
 * addEntry(): validate -> allocate an entry ID -> insert -> audit, all in one
 * transaction. Never trusts the client's own idea of its role.
 */
export async function addEntry(
  session: Session,
  regKey: RegisterKey,
  payload: Record<string, unknown>
): Promise<WriteResult> {
  if (!session.perms.add.includes(regKey)) {
    return { ok: false, errors: [`Your role (${session.role}) cannot add to ${regKey}.`] };
  }

  const lists = await allLists(session.tenantId);
  const { errs, clean } = validateEntry(regKey, payload, session, lists);
  if (errs.length) return { ok: false, errors: errs };

  const trimmed = (k: string) => String(payload[k] ?? "").trim() || null;

  return db.$transaction(async (tx) => {
    const entryId = await nextEntryId(tx, session.tenantId, regKey);
    const now = new Date();

    let projectId: string | undefined;
    if (REGISTERS_WITH_PROJECT.includes(regKey)) {
      const project = await tx.project.findUnique({
        where: { tenantId_name: { tenantId: session.tenantId, name: String(payload.project).trim() } },
        select: { id: true },
      });
      if (!project) return { ok: false, errors: [`Project "${payload.project}" not found.`] };
      projectId = project.id;
    }

    if (regKey === "EXPENSES") {
      await tx.expense.create({
        data: {
          tenantId: session.tenantId,
          entryId,
          date: clean.date as Date,
          particulars: String(payload.particulars).trim(),
          projectId: projectId!,
          category: String(payload.category).trim(),
          supplier: trimmed("supplier"),
          invoice: trimmed("invoice"),
          amount: clean.amount as number,
          paidFrom: String(payload.paidFrom).trim(),
          notes: trimmed("notes"),
          byUserId: session.userId,
          byName: session.name,
          at: now,
        },
      });
    } else if (regKey === "PAYROLL") {
      await tx.payroll.create({
        data: {
          tenantId: session.tenantId,
          entryId,
          payPeriod: String(payload.payPeriod).trim(),
          payDate: clean.payDate as Date,
          projectId: projectId!,
          workers: trimmed("workers"),
          regularPay: clean.regularPay as number,
          otPay: (clean.otPay as number) ?? 0,
          deductions: (clean.deductions as number) ?? 0,
          caGiven: (clean.caGiven as number) ?? 0,
          caDeduction: (clean.caDeduction as number) ?? 0,
          paidBy: String(payload.paidBy).trim(),
          reference: trimmed("reference"),
          remarks: trimmed("remarks"),
          byUserId: session.userId,
          byName: session.name,
          at: now,
        },
      });
    } else if (regKey === "COLLECTION") {
      await tx.collection.create({
        data: {
          tenantId: session.tenantId,
          entryId,
          date: clean.date as Date,
          particulars: String(payload.particulars).trim(),
          projectId: projectId!,
          billAmount: clean.billAmount as number,
          paymentMethod: String(payload.paymentMethod).trim(),
          chequeRef: trimmed("chequeRef"),
          ewt: (clean.ewt as number) ?? 0,
          depositedTo: String(payload.depositedTo).trim(),
          remarks: trimmed("remarks"),
          byUserId: session.userId,
          byName: session.name,
          at: now,
        },
      });
    } else if (regKey === "TRANSFERS") {
      await tx.transfer.create({
        data: {
          tenantId: session.tenantId,
          entryId,
          date: clean.date as Date,
          particulars: String(payload.particulars).trim(),
          fromAccount: String(payload.fromAccount).trim(),
          toAccount: String(payload.toAccount).trim(),
          amount: clean.amount as number,
          reference: trimmed("reference"),
          notes: trimmed("notes"),
          byUserId: session.userId,
          byName: session.name,
          at: now,
        },
      });
    }

    await audit(
      tx,
      session.tenantId,
      session.userId,
      session.name,
      session.role,
      "ADD",
      regKey,
      entryId,
      JSON.stringify(payload).slice(0, 400)
    );

    return { ok: true, id: entryId };
  });
}

const MODEL: Record<RegisterKey, "expense" | "payroll" | "collection" | "transfer"> = {
  EXPENSES: "expense",
  PAYROLL: "payroll",
  COLLECTION: "collection",
  TRANSFERS: "transfer",
};

/**
 * Ported from Code.gs voidEntry(). The row stays exactly where it is; only
 * voidedAt/voidReason change. Every total already filters voidedAt IS NULL.
 */
export async function voidEntry(
  session: Session,
  regKey: RegisterKey,
  entryId: string,
  reason: string
): Promise<WriteResult> {
  if (!session.perms.canVoid) {
    return { ok: false, errors: [`Your role (${session.role}) cannot void entries.`] };
  }
  if (!reason || reason.trim().length < 5) {
    return { ok: false, errors: ["Please give a reason (at least 5 characters)."] };
  }

  return db.$transaction(async (tx) => {
    const model = MODEL[regKey];
    // @ts-expect-error -- narrowed at runtime by `model`, Prisma's delegate union isn't inferred here
    const row = await tx[model].findUnique({
      where: { tenantId_entryId: { tenantId: session.tenantId, entryId } },
      select: { id: true, voidedAt: true },
    });
    if (!row) return { ok: false, errors: [`Entry ID not found: ${entryId}`] };
    if (row.voidedAt) return { ok: false, errors: ["That entry is already voided."] };

    // @ts-expect-error -- see above
    await tx[model].update({
      where: { id: row.id },
      data: { voidedAt: new Date(), voidReason: reason.trim() },
    });

    await audit(tx, session.tenantId, session.userId, session.name, session.role, "VOID", regKey, entryId, reason);

    return { ok: true, id: entryId };
  });
}
