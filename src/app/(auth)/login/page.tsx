"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { BUTTON, INPUT, LABEL, LINK } from "../form-styles";

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <div>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <p className="mt-1 mb-5 text-xs text-[var(--muted)]">
        Admin, staff and customers sign in here.
      </p>

      <form action={action} className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className={INPUT}
            required
          />
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
        ) : null}

        <button type="submit" className={BUTTON} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-xs">
        <a className={LINK} href="/forgot">
          Forgot password?
        </a>
        <a className={LINK} href="/register">
          Create an account
        </a>
      </div>

      <div className="mt-5 rounded-lg bg-[var(--background)] p-3 text-[11px] leading-relaxed text-[var(--muted)]">
        Demo accounts — admin@brightloop.test · staff@brightloop.test · customer@brightloop.test
        <br />
        Password: Brightloop#2026
      </div>
    </div>
  );
}
