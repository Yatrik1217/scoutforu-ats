import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChangePasswordForm } from "@/app/change-password/change-password-form";

// Reached from the emailed recovery link (via /auth/callback, which established
// a short-lived session). If there's no session, the link was bad/expired.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f6] p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[12px] shadow-[0_4px_14px_rgba(42,111,219,.45)]"
            style={{ background: "linear-gradient(135deg,#2A6FDB,#5b96f0)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-xl font-bold tracking-tight text-[#0e1320]">ScoutforU</div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a94a6]">ATS Platform</div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-7 shadow-[0_6px_24px_rgba(20,40,80,.08)]">
          <h1 className="font-display text-lg font-extrabold text-[#16203a]">Set a new password</h1>
          <p className="mb-5 text-[13px] font-medium text-[#8a94a6]">
            Choose a new password for your account.
          </p>
          <ChangePasswordForm forced={false} />
        </div>
      </div>
    </div>
  );
}
