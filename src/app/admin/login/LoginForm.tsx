"use client";

import { useActionState } from "react";
import { staffLogin, type StaffLoginState } from "./actions";

export default function StaffLoginForm() {
  const [state, action, pending] = useActionState<StaffLoginState, FormData>(staffLogin, { step: "email" });
  const onCode = state.step === "code";
  return (
    <form action={action}>
      <div className="field">
        <label className="lab req" htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} readOnly={onCode} />
      </div>
      {onCode && (
        <div className="field">
          <label className="lab req" htmlFor="code">6-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus />
        </div>
      )}
      <button className="btn" type="submit" name="intent" value={onCode ? "verify" : "email"} disabled={pending}>
        {pending ? "Please wait" : onCode ? "Sign in" : "Email me a code"}
      </button>
      {onCode && <button className="btn ghost" type="submit" name="intent" value="resend" formNoValidate>Send a new code</button>}
      {state.error && <div className="msg err show" role="alert">{state.error}</div>}
      {state.info && !state.error && <div className="msg good show">{state.info}</div>}
    </form>
  );
}
