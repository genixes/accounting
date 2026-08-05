import { redirect, notFound } from "next/navigation";
import { loadTenant, type FeatureKey } from "@/lib/tenant";
import { getSession } from "@/lib/auth";
import { REGISTERS } from "@/lib/registers";
import type { RegisterKey } from "@/lib/roles";
import { listsForSession } from "@/lib/lists";
import EntryForm from "./EntryForm";

const REGISTER_FEATURE: Partial<Record<RegisterKey, FeatureKey>> = {
  PAYROLL: "payroll",
  COLLECTION: "collection",
  TRANSFERS: "transfers",
};

export default async function NewEntryPage({ params }: { params: Promise<{ tenant: string; register: string }> }) {
  const { tenant: slug, register } = await params;
  const regKey = register as RegisterKey;
  if (!REGISTERS[regKey]) notFound();

  const tenant = await loadTenant(slug);
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.add.includes(regKey)) redirect(`/t/${slug}/ledger`);
  const feature = REGISTER_FEATURE[regKey];
  if (feature && !tenant.features[feature]) redirect(`/t/${slug}/ledger`);

  const lists = await listsForSession(tenant.id, session);

  return <EntryForm slug={slug} regKey={regKey} cfg={REGISTERS[regKey]} lists={lists} />;
}
