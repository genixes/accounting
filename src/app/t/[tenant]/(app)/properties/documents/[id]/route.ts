import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadTenant } from "@/lib/tenant";
import { readDocument } from "@/lib/documents";

// Authenticated, tenant-checked download. Files are never public and are
// always served as attachments with the stored (server-detected) type.
export async function GET(_req: Request, { params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params;
  const session = await getSession(slug);
  if (!session || !session.perms.canReport) return new NextResponse("Unauthorized", { status: 401 });
  const tenant = await loadTenant(slug);
  if (tenant.id !== session.tenantId || tenant.vertical !== "REAL_ESTATE") return new NextResponse("Not found", { status: 404 });

  const doc = await readDocument(session.tenantId, id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const ascii = doc.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new NextResponse(Buffer.from(doc.bytes), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Length": String(doc.bytes.length),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
