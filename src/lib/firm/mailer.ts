import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "./env";

export type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Same key twice = one email. Make it describe the event, e.g. `welcome:<orderId>`. */
  dedupeKey?: string;
};

/** Queue inside the caller's transaction, so the email exists iff the change committed. */
export async function enqueueEmail(tx: Prisma.TransactionClient, e: EmailInput) {
  await tx.emailOutbox.createMany({
    data: [{ to: e.to, subject: e.subject, textBody: e.text, htmlBody: e.html ?? null, dedupeKey: e.dedupeKey ?? null }],
    skipDuplicates: true,
  });
}

async function send(e: { to: string; subject: string; textBody: string; htmlBody: string | null }) {
  const cfg = env();
  if (cfg.EMAIL_DRIVER === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: cfg.EMAIL_FROM, to: [e.to], subject: e.subject, text: e.textBody, html: e.htmlBody ?? undefined }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Email provider returned HTTP ${res.status}`);
    return;
  }
  // console driver: development only. Never log in production (codes are secrets).
  if (process.env.NODE_ENV !== "production" && !process.env.VITEST) {
    console.log(`\n--- EMAIL to ${e.to} ---\nSubject: ${e.subject}\n\n${e.textBody}\n--- end ---\n`);
  }
}

const MAX_ATTEMPTS = 5;

/** Delivers queued mail. Safe to run concurrently: rows are claimed with SKIP LOCKED. */
export async function deliverPendingEmails(limit = 20): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  await db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string; to: string; subject: string; textBody: string; htmlBody: string | null; attempts: number }[]
      >`SELECT "id","to","subject","textBody","htmlBody","attempts" FROM "EmailOutbox"
        WHERE "status" = 'PENDING' ORDER BY "createdAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      for (const r of rows) {
        try {
          await send(r);
          await tx.emailOutbox.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), attempts: r.attempts + 1, lastError: null } });
          sent++;
        } catch (err) {
          const attempts = r.attempts + 1;
          await tx.emailOutbox.update({
            where: { id: r.id },
            data: { attempts, status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING", lastError: String((err as Error).message).slice(0, 300) },
          });
          failed++;
        }
      }
    },
    { timeout: 60_000 }
  );
  return { sent, failed };
}

/** Best-effort immediate delivery after a commit; the cron route is the safety net. */
export function deliverSoon() {
  void deliverPendingEmails().catch((e) => console.error("[email] delivery failed", (e as Error).message));
}
