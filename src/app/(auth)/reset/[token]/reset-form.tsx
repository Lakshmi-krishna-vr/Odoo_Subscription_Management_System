"use client";

import { useActionState } from "react";
import { resetAction, type AuthState } from "../../actions";
import { BUTTON, INPUT, LABEL } from "../../form-styles";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetAction, {});

  return (
    <div>
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <p className="mt-1 mb-5 text-xs text-[var(--muted)]">This link can be used once.</p>

      <form action={action} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <div>
          <label className={LABEL} htmlFor="password">
            New password
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
          {pending ? "Saving…" : "Set password"}
        </button>
      </form>
    </div>
  );
}
