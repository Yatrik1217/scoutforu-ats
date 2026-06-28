"use client";

import { useActionState, useState } from "react";
import { signInAction } from "@/lib/actions/auth";

const DEMO = [
  { label: "Master Admin", email: "riya.sharma@scoutforu.in", color: "#2a6fdb" },
  { label: "Recruiter", email: "aisha.khan@scoutforu.in", color: "#8b5cf6" },
  { label: "Client", email: "hr@acme.com", color: "#f59e0b" },
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("scoutforu123");

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

      <div className="mt-2 border-t border-[#f0f3f8] pt-4">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">
          Demo accounts · password scoutforu123
        </div>
        <div className="flex flex-col gap-1.5">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword("scoutforu123");
              }}
              className="flex items-center gap-2.5 rounded-[9px] border border-[#e6eaf1] bg-white px-3 py-2 text-left transition hover:bg-[#f4f7fc]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: d.color }}
              />
              <span className="flex-1 text-[13px] font-bold text-[#16203a]">
                {d.label}
              </span>
              <span className="text-[11px] font-medium text-[#9aa4b6]">
                {d.email}
              </span>
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
