import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Clock, AlertTriangle, ArrowRight, Sparkles, UserPlus } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { rankRoles, recruiterLoad, weeklyAdvice, type Reason } from "@/lib/priorities";
import { Avatar } from "@/components/bits";
import {
  CriticalToggle,
  AssignRecruiterSelect,
  RecruiterExpInput,
  ApplySuggestion,
} from "@/components/priorities-actions";

const LEVEL = {
  High: { bg: "#fdecec", fg: "#dc2626" },
  Medium: { bg: "#fff5e6", fg: "#b45309" },
  Low: { bg: "#eef4fe", fg: "#2a6fdb" },
} as const;

const toneCls = (t: Reason["tone"]) =>
  t === "red"
    ? "bg-[#fdecec] text-[#dc2626]"
    : t === "amber"
      ? "bg-[#fff5e6] text-[#b45309]"
      : t === "blue"
        ? "bg-[#eef4fe] text-[#2a6fdb]"
        : "bg-[#eef1f6] text-[#7a8696]";

export default async function PrioritiesPage() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");

  const ranked = rankRoles(ws);
  const load = recruiterLoad(ws);
  const advice = weeklyAdvice(ranked, load);
  const recruiterOpts = ws.team
    .filter((p) => p.role === "recruiter")
    .map((p) => ({ id: p.id, name: p.name }));
  const highCount = ranked.filter((r) => r.level === "High").length;

  const asOf = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 text-[12.5px] font-semibold text-[#8a94a6]">
        {asOf} · {ranked.length} open role{ranked.length === 1 ? "" : "s"} ·{" "}
        <span className="font-bold text-[#dc2626]">{highCount} high priority</span>
      </div>

      {/* Smart suggestions — automated assignment advice */}
      {(advice.picks.length > 0 || advice.needHire) && (
        <div className="mb-[18px] rounded-2xl border border-[#dce7fb] bg-[#f5f9ff] p-[18px_20px]">
          <div className="mb-2.5 flex items-center gap-2 text-[14px] font-extrabold text-[#16203a]">
            <Sparkles size={16} className="text-[#2a6fdb]" /> Smart suggestions
          </div>
          {advice.needHire && (
            <div className="mb-2.5 flex items-center gap-2 rounded-[10px] border border-[#f5d9a8] bg-[#fff7ea] px-3 py-2 text-[12.5px] font-bold text-[#b45309]">
              <UserPlus size={14} /> Every recruiter is at capacity with High roles waiting — consider adding a recruiter.
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {advice.picks.map(({ role, rec, reason }) => (
              <div key={role.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold capitalize text-[#42506b] ring-1 ring-[#e3e8f0]">
                  {role.seniority}
                </span>
                <span className="font-bold text-[#16203a]">{role.title}</span>
                <ArrowRight size={13} className="text-[#8a94a6]" />
                <span className="font-extrabold text-[#2a6fdb]">{rec.name}</span>
                <span className="text-[11.5px] font-semibold text-[#8a94a6]">
                  ({reason}{rec.overloaded ? " · note: also busy" : ""})
                </span>
                {role.recId !== rec.id && <ApplySuggestion jobId={role.id} recruiterId={rec.id} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.7fr_1fr]">
        {/* Priority roles */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-1 text-[15.5px] font-extrabold">Roles to push this week</div>
          <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">
            Ranked by days open, submissions to client, criticality &amp; sourcing gap
          </div>
          <div className="flex flex-col">
            {ranked.map((r, i) => (
              <div key={r.id} className="flex items-start gap-3 border-t border-[#f0f3f8] py-3 first:border-0">
                <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                  <span className="w-4 text-center text-[13px] font-extrabold text-[#c3ccdb]">{i + 1}</span>
                  <CriticalToggle jobId={r.id} critical={r.critical} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/pipeline?job=${r.id}`}
                      className="truncate text-[14px] font-bold text-[#16203a] hover:text-[#2a6fdb]"
                    >
                      {r.title}
                    </Link>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                      style={
                        r.critical
                          ? { background: "#dc2626", color: "#fff" }
                          : { background: LEVEL[r.level].bg, color: LEVEL[r.level].fg }
                      }
                    >
                      {r.critical ? "Critical" : r.level}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] font-semibold text-[#8a94a6]">
                    {[r.client, r.dept].filter(Boolean).join(" · ") || "—"} · {r.openings} opening
                    {r.openings === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${toneCls(r.action.tone)}`}>
                      <ArrowRight size={11} strokeWidth={2.6} /> {r.action.label}
                    </span>
                    {r.reasons.map((x, k) => (
                      <span key={k} className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${toneCls(x.tone)}`}>
                        {x.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 pt-0.5">
                  <AssignRecruiterSelect jobId={r.id} current={r.recId} recruiters={recruiterOpts} />
                </div>
              </div>
            ))}
            {ranked.length === 0 && (
              <div className="py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
                No open roles right now.
              </div>
            )}
          </div>
        </div>

        {/* Recruiter load */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-1 text-[15.5px] font-extrabold">Recruiter load</div>
          <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">
            Who has capacity to take the priority roles
          </div>
          <div className="flex flex-col gap-3">
            {load.map((m) => {
              const bar = m.pct > 90 ? "#ef4444" : m.pct > 55 ? "#f59e0b" : "#16a34a";
              return (
                <Link
                  key={m.id}
                  href="/team"
                  className="rounded-[13px] border border-[#eef1f6] bg-[#fafbfe] p-[12px_14px] transition hover:border-[#c9d6ee]"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size={34} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[13.5px] font-bold text-[#16203a]">
                        {m.name}
                        <RecruiterExpInput id={m.id} years={m.expYears} />
                        {m.overloaded && (
                          <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[9.5px] font-bold text-[#dc2626]">
                            Overloaded
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8a94a6]">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {m.active} active
                        </span>
                        <span>· {m.openings} openings</span>
                        {m.stalled > 0 && (
                          <span className="flex items-center gap-1 text-[#dc2626]">
                            <AlertTriangle size={11} /> {m.stalled} stalled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-[7px] flex-1 overflow-hidden rounded bg-[#f1f4f9]">
                      <div className="h-full rounded" style={{ width: `${Math.min(100, m.pct)}%`, background: bar }} />
                    </div>
                    <span className="tf-num w-9 text-right text-[11px] font-bold" style={{ color: bar }}>
                      {m.pct}%
                    </span>
                  </div>
                </Link>
              );
            })}
            {load.length === 0 && (
              <div className="py-8 text-center text-[12.5px] font-semibold text-[#a3acbd]">
                No recruiters yet.
              </div>
            )}
          </div>
          <div className="mt-3 flex items-start gap-1.5 text-[11px] font-medium text-[#a3acbd]">
            <Flame size={12} className="mt-0.5 shrink-0" /> Assign the red/high roles to whoever is greenest here.
          </div>
        </div>
      </div>
    </div>
  );
}
