"use client";

import { useActionState } from "react";
import { createStaffAction, toggleStaffAction, type StaffState } from "./actions";

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#1f5eff]";
const LABEL = "block text-xs font-medium text-[var(--muted)] mb-1";

export function NewStaffForm() {
  const [state, action, pending] = useActionState<StaffState, FormData>(createStaffAction, {});

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={LABEL} htmlFor="name">
            Name
          </label>
          <input id="name" name="name" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Work email
          </label>
          <input id="email" name="email" type="email" className={INPUT} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="password">
            Temporary password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={INPUT}
            required
          />
        </div>
      </div>

      <p className="text-[11px] text-[var(--muted)]">
        More than 8 characters, with an uppercase letter, a lowercase letter and a special character.
        Give this password to them; they can change it after signing in.
      </p>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#1f5eff] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a51d8] disabled:opacity-60"
      >
        {pending ? "Creating…" : "Add staff member"}
      </button>
    </form>
  );
}

export function ToggleStaffButton({
  userId,
  isActive,
  isSelf,
  isAdmin,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState<StaffState, FormData>(toggleStaffAction, {});

  if (isSelf || isAdmin) {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs hover:border-[#1f5eff] disabled:opacity-60"
      >
        {pending ? "…" : isActive ? "Deactivate" : "Reactivate"}
      </button>
      {state.error ? <span className="ml-2 text-[11px] text-red-700">{state.error}</span> : null}
    </form>
  );
}
