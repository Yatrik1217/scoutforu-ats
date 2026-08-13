import { Check } from "lucide-react";
import { LoginForm } from "./login-form";

const LOGO = (
  <div
    className="flex h-11 w-11 items-center justify-center rounded-[12px] shadow-[0_4px_14px_rgba(42,111,219,.45)]"
    style={{ background: "linear-gradient(135deg,#2A6FDB,#5b96f0)" }}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 14l4-4 3 3 5-6" />
    </svg>
  </div>
);

const FEATURES = [
  "Visual pipeline — drag candidates across every stage",
  "Branded careers page with one-click job publishing",
  "Interviews, offers, invoicing & analytics in one place",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deactivated?: string }>;
}) {
  const { deactivated } = await searchParams;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Brand panel — hidden on small screens */}
      <aside
        className="relative hidden w-[46%] max-w-[560px] flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ background: "linear-gradient(160deg,#1f5bc0 0%,#2a6fdb 46%,#123f8f 100%)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)",
            backgroundSize: "46px 46px",
            maskImage: "radial-gradient(circle at 30% 20%,#000,transparent 78%)",
            WebkitMaskImage: "radial-gradient(circle at 30% 20%,#000,transparent 78%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(circle,rgba(255,255,255,.22),transparent 70%)" }}
        />

        <div className="relative flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-white/15 backdrop-blur-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight">ScoutforU</div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/70">ATS Platform</div>
          </div>
        </div>

        <div className="relative">
          <h2 className="font-display text-[30px] font-extrabold leading-[1.15] tracking-tight text-white text-balance">
            Every hire, start to finish — in one place.
          </h2>
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-white/80">
            From requisition to offer: source, screen, schedule and close — with your team, your
            clients and your careers page all connected.
          </p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[13px] font-semibold text-white/95">
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Check size={12} strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-[12px] font-medium text-white/65">
          ScoutforU Consultants — recruitment, streamlined.
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            {LOGO}
            <div>
              <div className="font-display text-xl font-bold tracking-tight text-[#0e1320]">ScoutforU</div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a94a6]">ATS Platform</div>
            </div>
          </div>

          <h1 className="font-display text-[22px] font-extrabold text-[#16203a]">Welcome back</h1>
          <p className="mb-6 text-[13px] font-medium text-[#8a94a6]">Sign in to your recruitment workspace</p>

          {deactivated && (
            <div className="mb-4 rounded-[10px] bg-[#fef2f2] px-3.5 py-2.5 text-xs font-semibold text-[#dc2626]">
              Your account has been deactivated. Contact your admin.
            </div>
          )}

          <LoginForm />

          <p className="mt-6 text-[11.5px] font-medium text-[#a3acbd]">
            ScoutforU Consultants · Applicant Tracking System
          </p>
        </div>
      </main>
    </div>
  );
}
