"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export default function LoginForm({ tenantSlug }: { tenantSlug: string }) {
  const action = loginAction.bind(null, tenantSlug);
  const [state, formAction, pending] = useActionState<LoginState, FormData>(action, {});

  return (
    <form action={formAction}>
      <div className="field">
        <label className="lab req" htmlFor="name">Name</label>
        <input id="name" name="name" autoComplete="off" autoCapitalize="words" required />
      </div>
      <div className="field">
        <label className="lab req" htmlFor="pin">PIN</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" maxLength={8} required />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Checking" : "Sign in"}
      </button>
      {state.error && <div className="msg err show">{state.error}</div>}
    </form>
  );
}
