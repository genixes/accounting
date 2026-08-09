import { loadTenant } from "@/lib/tenant";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await loadTenant(slug);
  const b = tenant.branding;

  // The dark shell (page/card surfaces, text, radius) is fixed across every
  // tenant on purpose — only the accent/status colors are a client's own, so
  // the product still reads as "the same template" no matter who's using it.
  const vars = `
    [data-tenant="${tenant.slug}"] {
      --accent:${b.accent}; --accent-2:${b.accent2};
      --in:${b.positive}; --out:${b.negative};
    }
  `;

  return (
    <div data-tenant={tenant.slug}>
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      {children}
    </div>
  );
}
