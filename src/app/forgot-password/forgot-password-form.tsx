"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, null);
  const [email, setEmail] = useState("");

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[10px] bg-[#f0fdf4] px-4 py-3.5 text-[13px] font-semibold text-[#15803d]">
          If an account exists for <span className="font-bold">{email}</span>, a reset link is on its
          way. Check your inbox (and spam) — the link is valid for one hour.
        </div>
        <Link
          href="/login"
          className="rounded-[11px] bg-[#2a6fdb] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-[#1f5bc0]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#42506b]">Email</label>
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
        {pending ? "Sending…" : "Send reset link"}
      </button>

      <Link href="/login" className="text-center text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
