"use client";

import { useActionState } from "react";
import { clientLogin, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(clientLogin, { step: "email" });
  const onCode = state.step === "code";

  return (
    <form action={action}>
      {state.error && <div className="ferr" role="alert">{state.error}</div>}
      {state.info && !state.error && <div className="ok" role="status">{state.info}</div>}

      <div className="f">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} readOnly={onCode} />
      </div>

      {onCode && (
        <div className="f">
          <label htmlFor="code">6-digit code</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
        </div>
      )}

      <button className="fxb brass block" type="submit" name="intent" value={onCode ? "verify" : "email"} disabled={pending}>
        {pending ? "Please wait…" : onCode ? "Sign in" : "Email me a code"}
      </button>
      {onCode && (
        <p className="fine">
          No email?{" "}
          <button className="back" type="submit" name="intent" value="resend" formNoValidate>Send a new code</button>
        </p>
      )}
    </form>
  );
}
