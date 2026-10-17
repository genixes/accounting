import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { StaffRoleName, StaffSession } from "./staff-auth";

/** SUPPORT is read-only. */
export const canWrite = (role: StaffRoleName) => role === "ADMIN" || role === "PARTNER";
export const isAdmin = (role: StaffRoleName) => role === "ADMIN";

type Db = Prisma.TransactionClient | typeof db;

export async function staffAudit(client: Db, staff: StaffSession, action: string, targetType: string, targetId: string, details?: string) {
  await client.staffAudit.create({
    data: { staffId: staff.staffId, action, targetType, targetId, details: details?.slice(0, 400) },
  });
}

export class Forbidden extends Error {
  constructor(msg = "You do not have permission to do that.") {
    super(msg);
  }
}

export function assertCanWrite(staff: StaffSession) {
  if (!canWrite(staff.role)) throw new Forbidden();
}
export function assertAdmin(staff: StaffSession) {
  if (!isAdmin(staff.role)) throw new Forbidden();
}

/**
 * `<input type="datetime-local">` has no timezone. Our staff work in Manila
 * (UTC+8, no daylight saving), so a naive value is read as Manila time.
 */
export function parseManilaLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const ms = Date.UTC(y, mo - 1, d, h - 8, mi);
  const dt = new Date(ms);
  // Reject impossible dates such as Feb 31, which Date.UTC would roll over.
  const back = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return dt;
}

export function formatManila(d: Date): string {
  return d.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
}

/** Only https links are accepted for video calls (no javascript:, no plain http). */
export function safeMeetUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Calendar date from <input type="date">, stored at UTC midnight. */
export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}
