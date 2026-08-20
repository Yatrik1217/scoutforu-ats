"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Send, Trash2 } from "lucide-react";
import {
  saveMyEmailSettings,
  sendTestEmail,
  clearMyEmailSettings,
  type MyEmailSettings,
} from "@/lib/actions/my-email";

const PRESETS: Record<string, { host: string; port: number }> = {
  Gmail: { host: "smtp.gmail.com", port: 465 },
  "Google Workspace": { host: "smtp.gmail.com", port: 465 },
  Zoho: { host: "smtp.zoho.in", port: 465 },
  Outlook: { host: "smtp.office365.com", port: 587 },
};

const label = "mb-1 block text-[12px] font-bold text-[#42506b]";
const field =
  "w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

export function MyEmailForm({
  settings,
  myName,
  myEmail,
}: {
  settings: MyEmailSettings | null;
  myName: string;
  myEmail: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({
    from_name: settings?.from_name || myName || "",
    smtp_host: settings?.smtp_host || "",
    smtp_port: settings?.smtp_port || 465,
    smtp_user: settings?.smtp_user || myEmail || "",
    smtp_pass: "",
  });
  const configured = !!settings?.configured;
  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await saveMyEmailSettings(f);
      if (res.ok) {
        toast.success(res.message || "Saved");
        setF((p) => ({ ...p, smtp_pass: "" }));
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const test = () =>
    start(async () => {
      // Save first if there are unsaved edits, then test.
      const s = await saveMyEmailSettings(f);
      if (!s.ok) {
        toast.error(s.error || "Save failed");
        return;
      }
      setF((p) => ({ ...p, smtp_pass: "" }));
      const res = await sendTestEmail();
      if (res.ok) toast.success(res.message || "Test sent");
      else toast.error(res.error || "Test failed");
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      const res = await clearMyEmailSettings();
      if (res.ok) {
        toast.success(res.message || "Removed");
        setF({ from_name: myName || "", smtp_host: "", smtp_port: 465, smtp_user: myEmail || "", smtp_pass: "" });
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <div className="rounded-[14px] border border-[#e9edf3] bg-white p-5 shadow-[0_1px_2px_rgba(16,32,72,.04)]">
      <div className="mb-4 flex items-center gap-2">
        {configured ? (
          settings?.verified ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f6ee] px-2.5 py-1 text-[11px] font-bold text-[#15934e]">
              <CheckCircle2 size={13} /> Verified · sending from {settings.smtp_user}
            </span>
          ) : (
            <span className="rounded-full bg-[#fbf0e2] px-2.5 py-1 text-[11px] font-bold text-[#c9781f]">
              Saved — send a test to verify
            </span>
          )
        ) : (
          <span className="rounded-full bg-[#eef2f8] px-2.5 py-1 text-[11px] font-bold text-[#64748b]">
            Not set up — using the shared mailbox
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="mr-1 self-center text-[11px] font-semibold text-[#8a94a6]">Quick fill:</span>
        {Object.entries(PRESETS).map(([name, p]) => (
          <button
            key={name}
            onClick={() => setF((s) => ({ ...s, smtp_host: p.host, smtp_port: p.port }))}
            className="rounded-full border border-[#e3e8f0] px-2.5 py-1 text-[11px] font-bold text-[#42506b] hover:border-[#2a6fdb] hover:text-[#2a6fdb]"
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid gap-3.5">
        <div>
          <label className={label}>Sender name (shown to candidates)</label>
          <input className={field} value={f.from_name} onChange={(e) => set("from_name", e.target.value)} placeholder="e.g. Yashashvi Shah" />
        </div>
        <div>
          <label className={label}>Your email address (SMTP username)</label>
          <input className={field} value={f.smtp_user} onChange={(e) => set("smtp_user", e.target.value)} placeholder="you@scoutforu.com" />
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <div>
            <label className={label}>SMTP host</label>
            <input className={field} value={f.smtp_host} onChange={(e) => set("smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className={label}>Port</label>
            <input className={field} type="number" value={f.smtp_port} onChange={(e) => set("smtp_port", Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={label}>App password</label>
          <input
            className={field}
            type="password"
            value={f.smtp_pass}
            onChange={(e) => set("smtp_pass", e.target.value)}
            placeholder={configured ? "•••••••• (leave blank to keep current)" : "app-specific password"}
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11px] text-[#8a94a6]">
            Use an <b>app password</b> (Gmail/Workspace &amp; Zoho require 2-factor auth first) — not your
            normal login password. It&apos;s stored only to send on your behalf and never shown back.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={test}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
        >
          <Send size={14} /> Save &amp; send test
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="rounded-[9px] border border-[#e3e8f0] bg-white px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-50"
        >
          Save only
        </button>
        {configured && (
          <button
            onClick={remove}
            disabled={pending}
            className="ml-auto flex items-center gap-1.5 rounded-[9px] border border-[#f3c4c4] bg-[#fef2f2] px-3 py-2 text-[12px] font-bold text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-50"
          >
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>
    </div>
  );
}
