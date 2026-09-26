import Link from "next/link";
import { formatDistanceToNow, format, isToday, isTomorrow, isThisWeek } from "date-fns";
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  TrendingUp,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  loadWorkspace,
  activeCount,
  inInterviewCount,
  hiresCount,
} from "@/lib/data";
import { rankRoles, recruiterLoad, weeklyAdvice } from "@/lib/priorities";
import { getProfile } from "@/lib/auth";
import { ShieldCheck, Target, Sparkles, ArrowRight, UserPlus } from "lucide-react";
import { DEPT_COLOR, hexA } from "@/lib/domain";
import { Avatar, TypePill, typeLabelFromEnum } from "@/components/bits";

function avgTimeToHire(events: { candidate_id: string; to_stage: string; created_at: string }[]) {
  const byCand = new Map<string, typeof events>();
  for (const e of events) {
    const a = byCand.get(e.candidate_id) ?? [];
    a.push(e);
    byCand.set(e.candidate_id, a);
  }
  const durs: number[] = [];
  for (const arr of byCand.values()) {
    const sorted = [...arr].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
    );
    const joined = sorted.find((e) => e.to_stage === "joined");
    if (joined && sorted.length) {
      durs.push(
        (+new Date(joined.created_at) - +new Date(sorted[0].created_at)) /
          86_400_000,
      );
    }
  }
  if (!durs.length) return "—";
  return `${Math.round(durs.reduce((a, b) => a + b, 0) / durs.length)}d`;
}

export default async function OverviewPage() {
  const { ws } = await loadWorkspace();
  const me = await getProfile();
  const canReview = me?.role === "master_admin" || !!me?.is_approver;
  const pendingReviews = ws.candidates.filter((c) => c.review_status === "pending").length;

  // Funnel over the REAL pipeline stages (Default set), excluding lost outcomes
  // (rejected / declined / not-joined leave the funnel). Counts by actual slug,
  // so custom stages no longer collapse into "Sourced".
  const funnelStages = ws.pipeline.default.filter((s) => s.outcome !== "lost");
  const funnel = funnelStages.map((s) => ({
    name: s.name,
    color: s.color,
    slug: s.slug,
    count: ws.candidates.filter((c) => c.stage === s.slug && !c.on_hold).length,
  }));
  const fmax = Math.max(1, ...funnel.map((f) => f.count));
  const offersOut = ws.candidates.filter((c) => c.stage === "offered" && !c.on_hold).length;

  const metrics: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color: string;
    href: string;
  }[] = [
    { label: "Open Jobs", value: ws.jobs.filter((j) => j.status !== "closed").length, icon: Briefcase, color: "#2a6fdb", href: "/jobs" },
    { label: "Active Candidates", value: activeCount(ws.candidates), icon: Users, color: "#8b5cf6", href: "/candidates" },
    { label: "In Interview", value: inInterviewCount(ws.candidates), icon: Calendar, color: "#06b6d4", href: "/pipeline" },
    { label: "Offers Out", value: offersOut, icon: FileText, color: "#f59e0b", href: "/offers" },
    { label: "Hires (Joined)", value: hiresCount(ws.candidates), icon: CheckCircle2, color: "#16a34a", href: "/candidates?stage=joined" },
    { label: "Avg Time-to-Hire", value: avgTimeToHire(ws.events), icon: TrendingUp, color: "#0ea5e9", href: "/analytics" },
  ];

  // slug → display name for the activity feed (from the real pipeline).
  const stageNameOf = new Map(ws.pipeline.default.map((s) => [s.slug, s.name]));

  // Candidates currently in an interview round — shown in the right panel so
  // reviewers can see WHO is at the client/technical rounds (interviews are run
  // by the client, not scheduled in the ATS).
  const stageColorOf = new Map(ws.pipeline.default.map((s) => [s.slug, s.color]));
  const interviewCands = ws.candidates
    .filter((c) => c.stageIsInterview && !c.on_hold)
    .sort((a, b) => b.stagePosition - a.stagePosition || a.name.localeCompare(b.name));

  // Interviews the recruiters have MARKED (scheduled) — the day planner. Only
  // future/today ones matter for planning, so drop already-past days.
  const marked = ws.interviews
    .map((iv) => {
      const c = ws.byId.get(iv.candidate_id);
      const d = new Date(iv.scheduled_at);
      return { id: iv.id, type: iv.type, d, name: c?.name ?? "Candidate", role: c?.jobTitle ?? "" };
    })
    .sort((a, b) => +a.d - +b.d);
  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate.getTime() + 86_400_000);
  const startOfToday = new Date(todayDate.toDateString());
  const todayIv = marked.filter((x) => isToday(x.d));
  const tomorrowIv = marked.filter((x) => isTomorrow(x.d));
  const weekIvCount = marked.filter(
    (x) => isThisWeek(x.d, { weekStartsOn: 1 }) && +x.d >= +startOfToday,
  ).length;

  // Weekly Focus summary (admin) — priority roles, recruiter load & auto-advice.
  const isAdmin = me?.role === "master_admin";
  const ranked = isAdmin ? rankRoles(ws) : [];
  const load = isAdmin ? recruiterLoad(ws) : [];
  const advice = isAdmin ? weeklyAdvice(ranked, load) : { picks: [], overloaded: [], needHire: false };
  const topRoles = ranked.filter((r) => r.level === "High" || r.critical).slice(0, 4);
  const criticalN = ranked.filter((r) => r.critical).length;
  const LVL = {
    High: { bg: "#fdecec", fg: "#dc2626" },
    Medium: { bg: "#fff5e6", fg: "#b45309" },
    Low: { bg: "#eef4fe", fg: "#2a6fdb" },
  } as const;

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      {canReview && pendingReviews > 0 && (
        <Link
          href="/candidates?review=pending"
          className="mb-4 flex items-center gap-3 rounded-[13px] border border-[#fde68a] bg-[#fffbeb] p-[13px_16px] transition hover:border-[#fcd34d]"
        >
          <ShieldCheck size={18} className="shrink-0 text-[#b45309]" />
          <span className="flex-1 text-[13px] font-bold text-[#92400e]">
            {pendingReviews} profile{pendingReviews > 1 ? "s" : ""} awaiting your internal approval
            before client submission
          </span>
          <span className="text-[12.5px] font-extrabold text-[#b45309]">Review →</span>
        </Link>
      )}

      {/* metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Link
              key={m.label}
              href={m.href}
              className="rounded-2xl border border-[#e9edf3] bg-white p-[18px] transition hover:border-[#cbd7ea] hover:shadow-[0_6px_20px_rgba(20,32,58,.08)]"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
                  style={{ background: hexA(m.color, 0.12), color: m.color }}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div className="font-display tf-num mt-3.5 text-[30px] font-extrabold tracking-tight">
                {m.value}
              </div>
              <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">
                {m.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* interviews planned — day planner (client interviews marked by recruiters) */}
      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[15.5px] font-extrabold">
              <Calendar size={17} className="text-[#16a34a]" /> Interviews Planned
            </div>
            <div className="text-[12px] font-medium text-[#8a94a6]">
              {weekIvCount} scheduled this week · marked by recruiters (no calendar needed)
            </div>
          </div>
          <Link
            href="/interviews"
            className="rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
          >
            Full agenda →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InterviewDay label="Today" date={todayDate} items={todayIv} />
          <InterviewDay label="Tomorrow" date={tomorrowDate} items={tomorrowIv} />
        </div>
      </div>

      {/* weekly focus — priorities + recruiter load + auto-advice (admin) */}
      {isAdmin && ranked.length > 0 && (
        <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-[15.5px] font-extrabold">
                <Target size={17} className="text-[#2a6fdb]" /> Weekly Focus
              </div>
              <div className="text-[12px] font-medium text-[#8a94a6]">
                {ranked.length} open roles ·{" "}
                <span className="font-bold text-[#dc2626]">
                  {topRoles.length} to push{criticalN ? ` · ${criticalN} critical` : ""}
                </span>
              </div>
            </div>
            <Link
              href="/priorities"
              className="rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              Open board →
            </Link>
          </div>

          {(advice.picks.length > 0 || advice.needHire) && (
            <div className="mb-4 rounded-[12px] border border-[#dce7fb] bg-[#f5f9ff] p-[12px_14px]">
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold text-[#16203a]">
                <Sparkles size={13} className="text-[#2a6fdb]" /> Suggested assignments
              </div>
              {advice.needHire && (
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-[#b45309]">
                  <UserPlus size={13} /> Team at capacity with High roles waiting — consider adding a recruiter.
                </div>
              )}
              {advice.picks.slice(0, 3).map(({ role, rec, reason }) => (
                <div key={role.id} className="flex flex-wrap items-center gap-1.5 text-[12px] leading-6">
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold capitalize text-[#42506b] ring-1 ring-[#e3e8f0]">
                    {role.seniority}
                  </span>
                  <span className="font-bold text-[#16203a]">{role.title}</span>
                  <ArrowRight size={12} className="text-[#8a94a6]" />
                  <span className="font-extrabold text-[#2a6fdb]">{rec.name}</span>
                  <span className="text-[11px] font-semibold text-[#8a94a6]">({reason})</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* top roles */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9aa4b6]">Push these first</div>
              {topRoles.map((r) => (
                <Link
                  key={r.id}
                  href={`/pipeline?job=${r.id}`}
                  className="-mx-2 flex items-center gap-2 rounded-[9px] px-2 py-1.5 hover:bg-[#f6f8fb]"
                >
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold"
                    style={r.critical ? { background: "#dc2626", color: "#fff" } : { background: LVL[r.level].bg, color: LVL[r.level].fg }}
                  >
                    {r.critical ? "Critical" : r.level}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#16203a]">{r.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-[#2a6fdb]">{r.action.label}</span>
                </Link>
              ))}
              {topRoles.length === 0 && (
                <div className="py-3 text-[12px] font-semibold text-[#a3acbd]">Nothing urgent — nice.</div>
              )}
            </div>
            {/* recruiter load */}
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#9aa4b6]">Recruiter load</div>
              {load.map((m) => {
                const bar = m.pct > 90 ? "#ef4444" : m.pct > 55 ? "#f59e0b" : "#16a34a";
                return (
                  <div key={m.id} className="mb-2 flex items-center gap-2">
                    <span className="w-[92px] shrink-0 truncate text-[12px] font-bold text-[#42506b]">{m.name}</span>
                    <div className="h-[7px] flex-1 overflow-hidden rounded bg-[#f1f4f9]">
                      <div className="h-full rounded" style={{ width: `${Math.min(100, m.pct)}%`, background: bar }} />
                    </div>
                    <span className="tf-num w-9 text-right text-[11px] font-bold" style={{ color: bar }}>{m.pct}%</span>
                    {m.overloaded && <span className="text-[9.5px] font-bold text-[#dc2626]">busy</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* funnel + upcoming */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-[18px] flex items-center justify-between">
            <div>
              <div className="text-[15.5px] font-extrabold">Hiring Funnel</div>
              <div className="text-[12px] font-medium text-[#8a94a6]">
                Candidates by stage across all open roles
              </div>
            </div>
            <Link
              href="/pipeline"
              className="rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              Open Pipeline →
            </Link>
          </div>
          {funnel.map((s) => (
            <Link
              key={s.slug}
              href={`/candidates?stage=${s.slug}`}
              className="-mx-2 mb-[3px] flex items-center gap-3.5 rounded-[9px] px-2 py-1 hover:bg-[#f6f8fb]"
            >
              <div className="w-[150px] shrink-0 text-right text-[12.5px] font-semibold text-[#42506b]">
                {s.name}
              </div>
              <div className="h-[26px] flex-1 overflow-hidden rounded-[7px] bg-[#f1f4f9]">
                <div
                  className="h-full rounded-[7px]"
                  style={{
                    width: `${Math.max(4, (s.count / fmax) * 100)}%`,
                    background: `linear-gradient(90deg,${hexA(s.color, 0.85)},${s.color})`,
                  }}
                />
              </div>
              <div className="tf-num w-8 text-right text-[13px] font-extrabold">
                {s.count}
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/pipeline" className="text-[15.5px] font-extrabold hover:text-[#2a6fdb]">
              In Interview
            </Link>
            <Link
              href="/pipeline"
              className="tf-num rounded-full bg-[#eef4fe] px-2.5 py-[3px] text-[11.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              {interviewCands.length} candidates
            </Link>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {interviewCands.slice(0, 12).map((c) => (
              <Link
                href={`/pipeline?job=${c.job_id ?? ""}`}
                key={c.id}
                className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[11px] last:border-0 hover:bg-[#f6f8fb]"
              >
                <Avatar name={c.name} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">{c.name}</div>
                  <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">
                    {c.jobTitle}
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                  style={{
                    background: hexA(stageColorOf.get(c.stage) ?? "#64748b", 0.14),
                    color: stageColorOf.get(c.stage) ?? "#64748b",
                  }}
                >
                  {c.stageName}
                </span>
              </Link>
            ))}
          </div>
          {interviewCands.length > 12 && (
            <div className="pt-2 text-center text-[11.5px] font-semibold text-[#8a94a6]">
              + {interviewCands.length - 12} more in interview
            </div>
          )}
          {interviewCands.length === 0 && (
            <div className="py-6 text-center text-[12.5px] font-semibold text-[#a3acbd]">
              No one in an interview round right now.
            </div>
          )}
        </div>
      </div>

      {/* activity + open roles */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_1.55fr]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <Link href="/candidates" className="mb-4 block text-[15.5px] font-extrabold hover:text-[#2a6fdb]">
            Recent Activity
          </Link>
          {ws.events.slice(0, 6).map((e) => {
            const actor = e.by_user_id
              ? ws.profileById.get(e.by_user_id)
              : null;
            const cand = ws.byId.get(e.candidate_id);
            const initial = !e.from_stage;
            return (
              <Link
                href="/candidates"
                key={e.id}
                className="-mx-2 mb-[7px] flex gap-3 rounded-[10px] px-2 py-1.5 last:mb-0 hover:bg-[#f6f8fb]"
              >
                <div
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold text-white"
                  style={{ background: actor?.color ?? "#94a3b8" }}
                >
                  {(actor?.name ?? "System")
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] leading-snug text-[#42506b]">
                    <strong className="text-[#16203a]">
                      {actor?.name ?? "System"}
                    </strong>{" "}
                    {initial ? "added" : "moved"}{" "}
                    <strong className="text-[#16203a]">
                      {cand?.name ?? "a candidate"}
                      {!initial && ` to ${stageNameOf.get(e.to_stage) ?? e.to_stage}`}
                    </strong>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#a3acbd]">
                    {formatDistanceToNow(new Date(e.created_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[15.5px] font-extrabold">Open Roles</div>
            <Link
              href="/jobs"
              className="rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              View all →
            </Link>
          </div>
          {ws.jobs.slice(0, 5).map((j) => (
            <Link
              key={j.id}
              href="/pipeline"
              className="-mx-2.5 flex items-center gap-3.5 rounded-[10px] p-[11px_10px] hover:bg-[#f6f8fb]"
            >
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: DEPT_COLOR[j.dept] ?? "#64748b" }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">{j.title}</div>
                <div className="text-[11.5px] font-medium text-[#8a94a6]">
                  {j.dept} · {j.location} · {j.openings} openings
                </div>
              </div>
              <div className="text-right">
                <div className="tf-num text-[14px] font-extrabold">
                  {
                    ws.candidates.filter(
                      (c) => c.job_id === j.id && c.stageOutcome !== "lost",
                    ).length
                  }
                </div>
                <div className="text-[10.5px] font-semibold text-[#a3acbd]">
                  in pipeline
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterviewDay({
  label,
  date,
  items,
}: {
  label: string;
  date: Date;
  items: { id: string; type: string; d: Date; name: string; role: string }[];
}) {
  return (
    <div className="rounded-[14px] border border-[#eef1f6] bg-[#fafbfe] p-[14px_16px]">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[13.5px] font-extrabold text-[#16203a]">
          {label}{" "}
          <span className="text-[11.5px] font-semibold text-[#8a94a6]">· {format(date, "EEE, dd MMM")}</span>
        </div>
        <span className="tf-num rounded-full bg-[#e9f9ef] px-2.5 py-[3px] text-[11.5px] font-bold text-[#16a34a]">
          {items.length} interview{items.length === 1 ? "" : "s"}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="py-6 text-center text-[12px] font-semibold text-[#a3acbd]">No interviews marked.</div>
      ) : (
        <div className="flex flex-col">
          {items.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-t border-[#f0f3f8] py-2.5 first:border-0">
              <div className="tf-num w-[46px] shrink-0 text-[12px] font-bold text-[#2a6fdb]">{format(x.d, "HH:mm")}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[#16203a]">{x.name}</div>
                <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">{x.role || "—"}</div>
              </div>
              <TypePill type={typeLabelFromEnum(x.type)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
