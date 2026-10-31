"use client";

import { useActionState } from "react";
import { forgotAction, type AuthState } from "../actions";
import { BUTTON, INPUT, LABEL, LINK } from "../form-styles";

export default function ForgotPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotAction, {});

  return (
    <div>
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="mt-1 mb-5 text-xs text-[var(--muted)]">
        We will send a reset link to the email on your account.
      </p>

      <form action={action} className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className={INPUT} required />
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
        ) : null}

        {state.notice ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {state.notice}
            {state.link ? (
              <p className="mt-2">
                Mail delivery is not configured on this machine, so here is the link:{" "}
                <a className="underline" href={state.link}>
                  {state.link}
                </a>
              </p>
            ) : null}
          </div>
        ) : null}

        <button type="submit" className={BUTTON} disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-4 text-xs">
        <a className={LINK} href="/login">
          Back to sign in
        </a>
      </p>
    </div>
  );
}
