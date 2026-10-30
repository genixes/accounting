import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadTenant } from "@/lib/tenant";

export default async function TenantRootPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  const tenant = await loadTenant(slug);
  redirect(`/t/${slug}/${tenant.vertical === "REAL_ESTATE" ? "properties" : "dashboard"}`);
}
