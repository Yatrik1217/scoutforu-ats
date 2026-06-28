import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const { deactivated } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef1f6] p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[11px] shadow-[0_4px_14px_rgba(42,111,219,.45)]"
            style={{ background: "linear-gradient(135deg,#2A6FDB,#5b96f0)" }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-xl font-bold tracking-tight text-[#0e1320]">
              ScoutforU
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a94a6]">
              ATS Platform
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-7 shadow-[0_6px_24px_rgba(20,40,80,.08)]">
          <h1 className="text-lg font-extrabold text-[#16203a]">Welcome back</h1>
          <p className="mb-5 text-[13px] font-medium text-[#8a94a6]">
            Sign in to your recruitment workspace
          </p>
          {deactivated && (
            <div className="mb-4 rounded-[10px] bg-[#fef2f2] px-3.5 py-2.5 text-xs font-semibold text-[#dc2626]">
              Your account has been deactivated. Contact your admin.
            </div>
          )}
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-[11.5px] font-medium text-[#a3acbd]">
          ScoutforU Consultants · Applicant Tracking System
        </p>
      </div>
    </div>
  );
}
