"use client";

import { useActionState, useState } from "react";
import { signInAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#42506b]">
          Email
        </label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@scoutforu.in"
          className="w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3.5 py-2.5 text-sm font-medium text-[#16203a] outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#42506b]">
          Password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3.5 py-2.5 text-sm font-medium text-[#16203a] outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
      </div>

      {state?.error && (
        <div className="rounded-[10px] bg-[#fef2f2] px-3.5 py-2.5 text-xs font-semibold text-[#dc2626]">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-[11px] bg-[#2a6fdb] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] transition hover:bg-[#1f5bc0] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
