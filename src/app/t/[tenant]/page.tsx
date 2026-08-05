import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function TenantRootPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const session = await getSession(slug);
  redirect(session ? `/t/${slug}/dashboard` : `/t/${slug}/login`);
}
