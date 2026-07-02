"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Copy, RefreshCw, Eye, EyeOff } from "lucide-react";
import { regenerateApiToken } from "@/lib/actions/mutations";

export function ApiTokenCard({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState(initialToken);
  const [reveal, setReveal] = useState(false);
  const [pending, start] = useTransition();

  const gen = () =>
    start(async () => {
      const res = await regenerateApiToken();
      if (res.ok && res.token) {
        setToken(res.token);
        setReveal(true);
        toast.success("New API token generated");
      } else toast.error(res.error ?? "Failed");
    });

  const copy = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      toast.success("Token copied");
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
      <div className="mb-1 flex items-center gap-2 text-[15.5px] font-extrabold">
        <KeyRound size={17} className="text-[#2a6fdb]" /> Resume Import Token
      </div>
      <div className="mb-3 text-[11.5px] font-medium text-[#8a94a6]">
        Used by the Naukri Resdex browser extension to import candidates to your
        pipeline. Keep it secret — anyone with it can add candidates as you.
      </div>

      {token ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-[9px] bg-[#f7f9fc] px-3 py-2.5 text-[12px] font-semibold text-[#16203a]">
            {reveal ? token : "•".repeat(28)}
          </code>
          <button onClick={() => setReveal((v) => !v)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button onClick={copy} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
            <Copy size={15} />
          </button>
        </div>
      ) : (
        <div className="text-[12.5px] font-medium text-[#a3acbd]">
          No token yet — generate one to connect the extension.
        </div>
      )}

      <button
        onClick={gen}
        disabled={pending}
        className="mt-3 flex items-center gap-2 rounded-[10px] bg-[#eef4fe] px-4 py-2 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd] disabled:opacity-50"
      >
        <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
        {token ? "Regenerate token" : "Generate token"}
      </button>

      <div className="mt-3 rounded-[9px] bg-[#f7f9fc] p-3 text-[11px] font-medium text-[#7a8696]">
        Import endpoint:{" "}
        <code className="font-semibold text-[#42506b]">{origin}/api/import-candidate</code>
      </div>
    </div>
  );
}
