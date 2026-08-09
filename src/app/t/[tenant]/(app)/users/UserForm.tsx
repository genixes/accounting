"use client";

import { useActionState } from "react";
import { saveUserAction } from "./actions";
import type { SaveUserResult } from "@/lib/users";

const ROLE_OPTIONS = ["Encoder", "Foreman", "Bookkeeper", "Owner"];

export type EditingUser = {
  name: string;
  role: string;
  active: boolean;
  projects: string[];
} | null;

export default function UserForm({ slug, projects, editing }: { slug: string; projects: string[]; editing: EditingUser }) {
  const action = saveUserAction.bind(null, slug);
  const [state, formAction, pending] = useActionState<SaveUserResult | null, FormData>(action, null);

  return (
    <form action={formAction} key={editing?.name || "new"}>
      <div className="field">
        <label className="lab req" htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={editing?.name} readOnly={!!editing} required />
      </div>
      <div className="grid2">
        <div className="field" style={{ gridColumn: "1/-1" }}>
          <label className="lab req" htmlFor="role">Role</label>
          <select id="role" name="role" defaultValue={editing?.role || "Encoder"}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lab" htmlFor="pin">{editing ? "Reset PIN" : "PIN"}</label>
          <input id="pin" name="pin" inputMode="numeric" maxLength={8} placeholder={editing ? "Leave blank to keep current" : "4-8 digits"} required={!editing} />
        </div>
        <div className="field">
          <label className="lab" htmlFor="active">Status</label>
          <select id="active" name="active" defaultValue={editing?.active === false ? "0" : "1"}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label className="lab">Assigned Projects <span style={{ fontWeight: 400, textTransform: "none" }}>(used when role is Foreman)</span></label>
        <select name="projects" multiple defaultValue={editing?.projects || []} style={{ minHeight: 100 }}>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Saving" : editing ? "Save changes" : "Add user"}
      </button>
      {state?.ok === false && (
        <div className="msg err show"><ul>{state.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
      )}
      {state?.ok === true && <div className="msg good show">Saved.</div>}
    </form>
  );
}
