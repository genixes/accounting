import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import type { RegisterKey } from "@/lib/roles";
import VoidForm from "./VoidForm";

export default async function VoidConfirmPage({
  params,
}: {
  params: Promise<{ tenant: string; register: string; entryId: string }>;
}) {
  const { tenant: slug, register, entryId } = await params;
  const session = await getSession(slug);
  if (!session) redirect(`/t/${slug}/login`);
  if (!session.perms.canVoid) redirect(`/t/${slug}/ledger`);

  return (
    <div className="sheet" style={{ maxWidth: 560 }}>
      <div className="hd">
        <div><span className="lab">Void {entryId}</span><h2>Are you sure?</h2></div>
        <Link href={`/t/${slug}/ledger`}><button className="btn ghost" type="button" style={{ width: "auto" }}>Cancel</button></Link>
      </div>
      <div className="bd">
        <p style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 0 }}>
          The row stays in the ledger so the audit trail holds. Every total ignores it from here
          on. This cannot be undone from the app.
        </p>
        <VoidForm slug={slug} regKey={register as RegisterKey} entryId={entryId} />
      </div>
    </div>
  );
}
