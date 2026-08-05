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

  // The palette is data, not CSS — same principle as brand() in Index.html.
  // Each tenant's colors land as CSS custom properties scoped to this subtree.
  const vars = `
    [data-tenant="${tenant.slug}"] {
      --ink:${b.ink}; --accent:${b.accent}; --accent-2:${b.accent2};
      --in:${b.positive}; --out:${b.negative}; --paper:${b.paper};
    }
  `;

  return (
    <div data-tenant={tenant.slug}>
      <style dangerouslySetInnerHTML={{ __html: vars }} />
      {children}
    </div>
  );
}
