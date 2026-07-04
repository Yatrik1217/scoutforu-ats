import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { emailConfigured, fromAddress } from "@/lib/email";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default async function EmailSettingsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const ok = emailConfigured();
  const from = fromAddress();

  const vars: [string, string][] = [
    ["SMTP_HOST", "smtp.zoho.in  (or smtp.zoho.com / your provider)"],
    ["SMTP_PORT", "465 for SSL, or 587 for STARTTLS"],
    ["SMTP_USER", "your full email, e.g. yatrik@scoutforu.com"],
    ["SMTP_PASS", "an app-specific password (not your login password)"],
    ["SMTP_FROM", "optional — defaults to SMTP_USER"],
  ];

  return (
    <div className="animate-sc-fadein mx-auto max-w-[760px] p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Email (SMTP)</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>

      <div
        className={`mb-5 flex items-center gap-3 rounded-[12px] border p-4 ${
          ok ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-[#fecaca] bg-[#fef2f2]"
        }`}
      >
        {ok ? <CheckCircle2 className="text-[#16a34a]" /> : <AlertCircle className="text-[#dc2626]" />}
        <div>
          <div className="text-[14px] font-extrabold text-[#16203a]">
            {ok ? "Email is configured" : "Email is not configured"}
          </div>
          <div className="text-[12.5px] text-[#6b7686]">
            {ok
              ? `Sending as ${from}. The "Share with Client" action will email trackers + résumés.`
              : "Add the SMTP environment variables below to enable client emails."}
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
          <Mail size={16} /> Environment variables
        </div>
        <p className="mb-3 text-[12.5px] text-[#8a94a6]">
          Set these in Vercel → Settings → Environment Variables (and your local <code>.env.local</code>), then redeploy.
        </p>
        <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
          {vars.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 border-b border-[#f4f6fa] p-[10px_14px] last:border-0 sm:flex-row sm:items-center sm:gap-4">
              <code className="w-[130px] shrink-0 text-[12.5px] font-bold text-[#2a6fdb]">{k}</code>
              <span className="text-[12.5px] text-[#6b7686]">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#8a94a6]">
          Zoho app password: My Account → Security → App Passwords. Then use{" "}
          <b>Candidates → Share with Client</b> to send a test to your own address.
        </p>
      </div>
    </div>
  );
}
