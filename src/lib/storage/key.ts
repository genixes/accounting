import { randomUUID } from "node:crypto";

/** Allowed upload types. Extension is derived from the *detected* type, never
 *  from the client's filename, so a renamed file can't smuggle a new type in. */
export const ALLOWED: Record<string, { ext: string; mime: string }> = {
  pdf: { ext: "pdf", mime: "application/pdf" },
  png: { ext: "png", mime: "image/png" },
  jpg: { ext: "jpg", mime: "image/jpeg" },
  webp: { ext: "webp", mime: "image/webp" },
  docx: { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  txt: { ext: "txt", mime: "text/plain" },
  csv: { ext: "csv", mime: "text/csv" },
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Detects the real type from magic bytes. Null = not an allowed type. Plain
 *  text/csv have no signature, so they're accepted only if valid UTF-8 with no
 *  control bytes. Office files are ZIP containers; the extension hint decides
 *  docx vs xlsx (both are inert downloads, served as attachments). */
export function detectType(bytes: Uint8Array, nameHint: string): keyof typeof ALLOWED | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    const ext = nameHint.toLowerCase().split(".").pop();
    return ext === "xlsx" ? "xlsx" : ext === "docx" ? "docx" : null;
  }
  const ext = nameHint.toLowerCase().split(".").pop();
  if (ext === "txt" || ext === "csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, 4096));
      // eslint-disable-next-line no-control-regex
      if (!/[\x00-\x08\x0e-\x1f]/.test(text)) return ext;
    } catch {
      return null;
    }
  }
  return null;
}

/** Display-safe filename: no path parts, no control chars, bounded length. */
export function safeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f"<>|:*?]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || "document";
}

/** Storage key is tenant-scoped and fully server-generated (no user text). */
export function storageKey(tenantId: string, propertyId: string | null, ext: string): string {
  return `${tenantId}/${propertyId ?? "general"}/${randomUUID()}.${ext}`;
}

/** Keys we issue contain only [A-Za-z0-9_-], '/', '.'. Anything else is refused. */
export const isValidKey = (k: string) => /^[\w-]+\/[\w-]+\/[\w-]+\.[a-z0-9]{2,5}$/.test(k) && !k.includes("..");
