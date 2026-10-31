"use client";

import { useActionState } from "react";
import { registerAction, type AuthState } from "../actions";
import { BUTTON, INPUT, LABEL, LINK } from "../form-styles";

export default function RegisterPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(registerAction, {});

  return (
    <div>
      <h1 className="text-lg font-semibold">Create an account</h1>
      <p className="mt-1 mb-5 text-xs text-[var(--muted)]">
        One account per email address.
      </p>

      <form action={action} className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="company">
            Company
          </label>
          <input id="company" name="company" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Work email
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
            autoComplete="new-password"
            className={INPUT}
            required
          />
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            More than 8 characters, with an uppercase letter, a lowercase letter and a special
            character.
          </p>
        </div>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
        ) : null}

        <button type="submit" className={BUTTON} disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-xs">
        Already have an account?{" "}
        <a className={LINK} href="/login">
          Sign in
        </a>
      </p>
    </div>
  );
}
