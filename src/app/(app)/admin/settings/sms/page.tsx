import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { smsProvider } from "@/lib/sms";
import { SmsTestForm } from "@/components/settings-modules";
import { MessageSquareText, CheckCircle2, AlertCircle } from "lucide-react";

export default async function SmsSettingsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const provider = smsProvider();

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">SMS Settings</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>

      <div
        className={`mb-5 flex items-center gap-3 rounded-[12px] border p-4 ${
          provider ? "border-[#bbf7d0] bg-[#f0fdf4]" : "border-[#fecaca] bg-[#fef2f2]"
        }`}
      >
        {provider ? <CheckCircle2 className="text-[#16a34a]" /> : <AlertCircle className="text-[#dc2626]" />}
        <div>
          <div className="text-[14px] font-extrabold text-[#16203a]">
            {provider ? `SMS configured (${provider})` : "SMS is not configured"}
          </div>
          <div className="text-[12.5px] text-[#6b7686]">
            {provider
              ? "Send a test below to verify the gateway."
              : "Add the environment variables for one provider below, then redeploy."}
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
        <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
          <MessageSquareText size={16} /> Providers (pick one)
        </div>
        <div className="overflow-hidden rounded-[10px] border border-[#eef1f6] text-[12.5px]">
          <div className="border-b border-[#f4f6fa] p-[10px_14px]">
            <b className="text-[#2a6fdb]">MSG91</b> (India) — set{" "}
            <code>SMS_PROVIDER=msg91</code>, <code>MSG91_AUTH_KEY</code>,{" "}
            <code>MSG91_SENDER</code> (6-char sender ID, DLT-approved).
          </div>
          <div className="p-[10px_14px]">
            <b className="text-[#2a6fdb]">Twilio</b> — set <code>SMS_PROVIDER=twilio</code>,{" "}
            <code>TWILIO_ACCOUNT_SID</code>, <code>TWILIO_AUTH_TOKEN</code>,{" "}
            <code>TWILIO_FROM</code> (your Twilio number).
          </div>
        </div>
        <p className="mt-3 text-[12px] text-[#8a94a6]">
          Set these in Vercel → Settings → Environment Variables and redeploy. India requires
          DLT registration for transactional SMS — MSG91 walks you through it.
        </p>
        <SmsTestForm configured={!!provider} />
      </div>
    </div>
  );
}
