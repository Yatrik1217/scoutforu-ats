"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { changePasswordAction } from "@/lib/actions/auth";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#42506b]">
          New password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3.5 py-2.5 text-sm font-medium text-[#16203a] outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-bold text-[#42506b]">
          Confirm new password
        </label>
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your new password"
          className="w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3.5 py-2.5 text-sm font-medium text-[#16203a] outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
      </div>

      {(mismatch || state?.error) && (
        <div className="rounded-[10px] bg-[#fef2f2] px-3.5 py-2.5 text-xs font-semibold text-[#dc2626]">
          {mismatch ? "The two passwords don't match." : state?.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || password.length < 8 || mismatch}
        className="mt-1 rounded-[11px] bg-[#2a6fdb] px-4 py-3 text-sm font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] transition hover:bg-[#1f5bc0] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>

      {!forced && (
        <Link
          href="/pipeline"
          className="text-center text-[12.5px] font-semibold text-[#8a94a6] hover:text-[#42506b]"
        >
          Cancel
        </Link>
      )}
    </form>
  );
}
