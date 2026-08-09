import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

// Modules a tenant's plan can turn off. Expenses stays mandatory — every
// construction ledger needs at least one register. Absence of a
// TenantFeature row means "on", so a fresh tenant is fully-featured until
// something is explicitly turned off.
export const FEATURE_KEYS = [
  "payroll",
  "collection",
  "transfers",
  "reports",
  "users",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Branding = {
  company: string;
  ink: string;
  accent: string;
  accent2: string;
  positive: string;
  negative: string;
  paper: string;
  logoUrl: string | null;
};

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  branding: Branding;
  features: Record<FeatureKey, boolean>;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function hex(v: string | undefined, fallback: string) {
  return v && HEX.test(v) ? v : fallback;
}

export const loadTenant = cache(async (slug: string): Promise<TenantContext> => {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    include: { branding: true, features: true },
  });
  if (!tenant) notFound();

  const features = Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, true])
  ) as Record<FeatureKey, boolean>;
  for (const f of tenant.features) {
    if ((FEATURE_KEYS as readonly string[]).includes(f.key)) {
      features[f.key as FeatureKey] = f.enabled;
    }
  }

  const b = tenant.branding;
  const branding: Branding = {
    company: b?.company || tenant.name,
    ink: hex(b?.ink, "#101634"),
    accent: hex(b?.accent, "#2E4ABE"),
    accent2: hex(b?.accent2, "#32A9DC"),
    positive: hex(b?.positive, "#0C6B59"),
    negative: hex(b?.negative, "#C0242E"),
    paper: hex(b?.paper, "#EEF1F7"),
    logoUrl: b?.logoUrl && /^https?:\/\//i.test(b.logoUrl) ? b.logoUrl : null,
  };

  return { id: tenant.id, slug: tenant.slug, name: tenant.name, branding, features };
});
