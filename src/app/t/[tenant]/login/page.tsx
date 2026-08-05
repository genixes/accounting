import { redirect } from "next/navigation";
import { loadTenant } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (session) redirect(`/t/${slug}/dashboard`);

  return (
    <div id="login">
      <div className="box">
        <div className="plate">
          {tenant.branding.logoUrl && (
            <div style={{ background: "#fff", padding: "9px 11px", borderRadius: 2, display: "inline-block", marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tenant.branding.logoUrl} alt={tenant.branding.company} style={{ maxWidth: "100%", maxHeight: 54, display: "block" }} />
            </div>
          )}
          <div className="t">{tenant.branding.company || "Construction Accounting"}</div>
          <div className="s">Ledger &amp; Project Control</div>
        </div>
        <div className="card">
          <LoginForm tenantSlug={slug} />
        </div>
      </div>
    </div>
  );
}
