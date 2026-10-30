import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Session } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { ALLOWED, MAX_UPLOAD_BYTES, detectType, safeName, storageKey } from "@/lib/storage/key";
import { buildAlerts, type Alert } from "@/lib/finance/alerts";
import type { Result } from "@/lib/realestate";

export const DOC_CATEGORIES = ["DEED", "TITLE", "CLOSING", "LEASE", "INSURANCE", "TAX", "INSPECTION", "RECEIPT", "LOAN", "OTHER"] as const;
export type DocCat = (typeof DOC_CATEGORIES)[number];
export const DOC_LABEL: Record<DocCat, string> = {
  DEED: "Deed", TITLE: "Title", CLOSING: "Closing", LEASE: "Lease", INSURANCE: "Insurance", TAX: "Tax",
  INSPECTION: "Inspection", RECEIPT: "Receipt", LOAN: "Loan", OTHER: "Other",
};

export async function uploadDocument(
  session: Session,
  input: { propertyId: string; category: string; name: string; file: File | null; expiresOn: Date | null }
): Promise<Result> {
  if (!(DOC_CATEGORIES as readonly string[]).includes(input.category)) return { ok: false, error: "Pick a document category." };
  const prop = await db.realProperty.findFirst({ where: { id: input.propertyId, tenantId: session.tenantId } });
  if (!prop) return { ok: false, error: "Property not found." };
  const f = input.file;
  if (!f || typeof f === "string" || f.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (f.size > MAX_UPLOAD_BYTES) return { ok: false, error: `File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` };
  if (input.expiresOn && Number.isNaN(input.expiresOn.getTime())) return { ok: false, error: "Invalid expiry date." };

  const bytes = new Uint8Array(await f.arrayBuffer());
  const type = detectType(bytes, f.name);
  if (!type) return { ok: false, error: "Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, DOCX, XLSX, TXT, CSV." };

  const original = safeName(f.name);
  const name = input.name.trim().slice(0, 120) || original;
  const key = storageKey(session.tenantId, prop.id, ALLOWED[type].ext);
  const storage = getStorage();
  await storage.put(key, bytes, ALLOWED[type].mime);
  try {
    await db.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          tenantId: session.tenantId, propertyId: prop.id, category: input.category as DocCat, name, originalName: original,
          storageKey: key, mimeType: ALLOWED[type].mime, sizeBytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
          expiresOn: input.expiresOn, uploadedById: session.userId, uploadedByName: session.name,
        },
      });
      await audit(tx, session.tenantId, session.userId, session.name, session.role, "DOC_ADD", "DOCUMENT", d.id, `${prop.name}: ${name}`);
    });
  } catch (e) {
    // Don't leave an orphaned object behind if the index row failed.
    await storage.remove(key).catch(() => {});
    throw e;
  }
  return { ok: true };
}

export async function voidDocument(session: Session, id: string, reason: string): Promise<Result> {
  if (!session.perms.canVoid) return { ok: false, error: "Your role cannot remove documents." };
  if (!reason.trim()) return { ok: false, error: "A reason is required." };
  const d = await db.document.findFirst({ where: { id, tenantId: session.tenantId } });
  if (!d) return { ok: false, error: "Document not found." };
  if (d.voidedAt) return { ok: false, error: "Document is already removed." };
  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id: d.id }, data: { voidedAt: new Date(), voidReason: reason.trim() } });
    await audit(tx, session.tenantId, session.userId, session.name, session.role, "DOC_VOID", "DOCUMENT", d.id, reason.trim());
  });
  return { ok: true };
}

/** Tenant-checked read. Returns null for unknown/foreign/removed documents (same answer for all three). */
export async function readDocument(tenantId: string, id: string) {
  const d = await db.document.findFirst({ where: { id, tenantId, voidedAt: null } });
  if (!d) return null;
  const bytes = await getStorage().get(d.storageKey);
  return { bytes, mime: d.mimeType, filename: d.originalName, sha256: d.sha256 };
}

export async function getAlerts(tenantId: string, today = new Date(), horizonDays = 90): Promise<Alert[]> {
  const owned = { stage: { in: ["OWNED", "LEASED", "HELD", "LISTED"] as ("OWNED" | "LEASED" | "HELD" | "LISTED")[] } };
  const [leases, docs, loans, units] = await Promise.all([
    db.lease.findMany({ where: { endedAt: null, endDate: { not: null }, unit: { property: { tenantId, ...owned } } }, include: { unit: { include: { property: true } } } }),
    db.document.findMany({ where: { tenantId, voidedAt: null, expiresOn: { not: null }, propertyId: { not: null } }, include: { property: true } }),
    db.loan.findMany({ where: { property: { tenantId, ...owned } }, include: { property: true } }),
    db.unit.findMany({ where: { property: { tenantId, ...owned }, leases: { none: { endedAt: null } } }, include: { property: true } }),
  ]);
  return buildAlerts({
    today, horizonDays,
    leases: leases.map((l) => ({ propertyId: l.unit.propertyId, propertyName: l.unit.property.name, unit: l.unit.label, tenantName: l.tenantName, endDate: l.endDate })),
    documents: docs.map((d) => ({ propertyId: d.propertyId, propertyName: d.property?.name ?? null, name: d.name, category: d.category, expiresOn: d.expiresOn })),
    loans: loans.map((l) => ({ propertyId: l.propertyId, propertyName: l.property.name, lender: l.lender, startDate: l.startDate, termYears: l.termYears })),
    vacancies: units.map((u) => ({ propertyId: u.propertyId, propertyName: u.property.name, unit: u.label })),
  });
}
