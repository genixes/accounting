"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/firm/staff-auth";
import { assertCanWrite, parseDateOnly, parseManilaLocal, safeMeetUrl, staffAudit, formatManila } from "@/lib/firm/staff";
import { enqueueEmail, deliverSoon } from "@/lib/firm/mailer";
import { BRAND } from "@/lib/firm/brand";

const here = (tenantId: string) => `/admin/clients/${encodeURIComponent(tenantId)}`;
const back = (tenantId: string, code: string) => redirect(`${here(tenantId)}?e=${code}`);

export async function scheduleConsult(tenantId: string, consultId: string, formData: FormData) {
  const staff = await requireStaff();
  assertCanWrite(staff);

  const when = parseManilaLocal(String(formData.get("when") || ""));
  const meet = safeMeetUrl(String(formData.get("meetUrl") || ""));
  if (!when) return back(tenantId, "when");
  if (when.getTime() < Date.now() - 60_000) return back(tenantId, "past");
  if (!meet) return back(tenantId, "url");

  // The consult must belong to the client in the URL, or one client's page could edit another's.
  const consult = await db.consult.findFirst({ where: { id: consultId, tenantId }, include: { lead: true } });
  if (!consult || consult.status === "DONE" || consult.status === "CANCELLED") return back(tenantId, "consult");

  await db.$transaction(async (tx) => {
    await tx.consult.update({ where: { id: consult.id }, data: { status: "SCHEDULED", scheduledFor: when, meetUrl: meet, assignedToId: staff.staffId } });
    await staffAudit(tx, staff, "CONSULT_SCHEDULE", "Consult", consult.id, `${when.toISOString()} ${meet}`);
    await enqueueEmail(tx, {
      to: consult.lead.email,
      dedupeKey: `consult:${consult.id}:${when.toISOString()}`,
      subject: `Your consultation is scheduled: ${formatManila(when)}`,
      text: `Hi ${consult.lead.name},\n\nYour consultation with ${staff.name} is scheduled for ${formatManila(when)} (Philippine time).\n\nJoin here: ${meet}\n\n— ${BRAND.name}`,
    });
  });
  deliverSoon();
  revalidatePath(here(tenantId));
  redirect(`${here(tenantId)}?ok=scheduled`);
}

const DeadlineInput = z.object({
  title: z.string().trim().min(3).max(120),
  notes: z.string().trim().max(300).optional(),
});

export async function addDeadline(tenantId: string, formData: FormData) {
  const staff = await requireStaff();
  assertCanWrite(staff);
  const due = parseDateOnly(String(formData.get("dueDate") || ""));
  const parsed = DeadlineInput.safeParse({ title: formData.get("title"), notes: formData.get("notes") || undefined });
  if (!parsed.success) return back(tenantId, "title");
  if (!due) return back(tenantId, "date");
  if (!(await db.tenant.findFirst({ where: { id: tenantId, kind: "SELLER" }, select: { id: true } }))) return back(tenantId, "consult");

  await db.$transaction(async (tx) => {
    const d = await tx.complianceDeadline.create({ data: { tenantId, title: parsed.data.title, notes: parsed.data.notes || null, dueDate: due } });
    await staffAudit(tx, staff, "DEADLINE_ADD", "ComplianceDeadline", d.id, `${parsed.data.title} ${due.toISOString().slice(0, 10)}`);
  });
  revalidatePath(here(tenantId));
  revalidatePath(`/t`, "layout");
  redirect(`${here(tenantId)}?ok=deadline`);
}

export async function toggleDeadline(tenantId: string, deadlineId: string) {
  const staff = await requireStaff();
  assertCanWrite(staff);
  const d = await db.complianceDeadline.findFirst({ where: { id: deadlineId, tenantId } });
  if (!d) return back(tenantId, "consult");
  const done = d.status === "OPEN";
  await db.$transaction(async (tx) => {
    await tx.complianceDeadline.update({ where: { id: d.id }, data: { status: done ? "DONE" : "OPEN", completedAt: done ? new Date() : null } });
    await staffAudit(tx, staff, done ? "DEADLINE_DONE" : "DEADLINE_REOPEN", "ComplianceDeadline", d.id, d.title);
  });
  revalidatePath(here(tenantId));
  revalidatePath(`/t`, "layout");
  redirect(here(tenantId));
}

export async function deleteDeadline(tenantId: string, deadlineId: string) {
  const staff = await requireStaff();
  assertCanWrite(staff);
  const d = await db.complianceDeadline.findFirst({ where: { id: deadlineId, tenantId } });
  if (!d) return back(tenantId, "consult");
  await db.$transaction(async (tx) => {
    await tx.complianceDeadline.delete({ where: { id: d.id } });
    await staffAudit(tx, staff, "DEADLINE_DELETE", "ComplianceDeadline", d.id, `${d.title} ${d.dueDate.toISOString().slice(0, 10)}`);
  });
  revalidatePath(here(tenantId));
  revalidatePath(`/t`, "layout");
  redirect(here(tenantId));
}
