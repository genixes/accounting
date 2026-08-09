"use client";

import { useActionState } from "react";
import { voidAction, type VoidState } from "../../../actions";
import type { RegisterKey } from "@/lib/roles";

export default function VoidForm({ slug, regKey, entryId }: { slug: string; regKey: RegisterKey; entryId: string }) {
  const action = voidAction.bind(null, slug, regKey, entryId);
  const [state, formAction, pending] = useActionState<VoidState, FormData>(action, {});

  return (
    <form action={formAction}>
      <div className="field">
        <label className="lab req" htmlFor="reason">Reason</label>
        <textarea id="reason" name="reason" placeholder="Duplicate of EXP-2026-000041" required minLength={5} />
      </div>
      <button className="btn danger" type="submit" disabled={pending}>
        {pending ? "Voiding" : "Void this entry"}
      </button>
      {state.error && <div className="msg err show">{state.error}</div>}
    </form>
  );
}
