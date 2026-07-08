import Link from "next/link";
import { formatDistanceToNow, format, isThisWeek } from "date-fns";
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  loadWorkspace,
  funnelCounts,
  activeCount,
  stageCount,
} from "@/lib/data";
import { getProfile } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";
import {
  PIPELINE_STAGES,
  DEPT_COLOR,
  hexA,
  stageFromSlug,
  stageToSlug,
} from "@/lib/domain";
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
  const counts = funnelCounts(ws.candidates);
  const fmax = Math.max(1, ...counts);
  const interviewsThisWeek = ws.interviews.filter((i) =>
    isThisWeek(new Date(i.scheduled_at), { weekStartsOn: 1 }),
  ).length;

  const metrics: {
    label: string;
    value: string | number;
    delta: string;
    up: boolean;
    icon: LucideIcon;
    color: string;
    href: string;
  }[] = [
    { label: "Open Jobs", value: ws.jobs.length, delta: "+2", up: true, icon: Briefcase, color: "#2a6fdb", href: "/jobs" },
    { label: "Active Candidates", value: activeCount(ws.candidates), delta: "+11", up: true, icon: Users, color: "#8b5cf6", href: "/candidates" },
    { label: "Interviews / wk", value: interviewsThisWeek, delta: "+3", up: true, icon: Calendar, color: "#06b6d4", href: "/interviews" },
    { label: "Offers Out", value: stageCount(ws.candidates, "Offered"), delta: "+1", up: true, icon: FileText, color: "#f59e0b", href: "/offers" },
    { label: "Avg Time-to-Hire", value: avgTimeToHire(ws.events), delta: "-3d", up: true, icon: TrendingUp, color: "#16a34a", href: "/analytics" },
  ];

  const upcoming = ws.interviews.slice(0, 5);

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
      <div className="grid grid-cols-5 gap-4">
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
                <span
                  className="rounded-full px-2 py-[3px] text-[12px] font-extrabold"
                  style={{
                    color: m.up ? "#16a34a" : "#ef4444",
                    background: m.up ? "#e9f9ef" : "#fef2f2",
                  }}
                >
                  {m.delta}
                </span>
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

      {/* funnel + upcoming */}
      <div className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[18px]">
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
          {PIPELINE_STAGES.map((s, i) => (
            <Link
              key={s.key}
              href={`/candidates?stage=${stageToSlug(s.key)}`}
              className="-mx-2 mb-[3px] flex items-center gap-3.5 rounded-[9px] px-2 py-1 hover:bg-[#f6f8fb]"
            >
              <div className="w-[130px] shrink-0 text-right text-[12.5px] font-semibold text-[#42506b]">
                {s.key}
              </div>
              <div className="h-[26px] flex-1 overflow-hidden rounded-[7px] bg-[#f1f4f9]">
                <div
                  className="h-full rounded-[7px]"
                  style={{
                    width: `${Math.max(4, (counts[i] / fmax) * 100)}%`,
                    background: `linear-gradient(90deg,${hexA(s.color, 0.85)},${s.color})`,
                  }}
                />
              </div>
              <div className="tf-num w-8 text-right text-[13px] font-extrabold">
                {counts[i]}
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <Link href="/interviews" className="text-[15.5px] font-extrabold hover:text-[#2a6fdb]">
              Upcoming Interviews
            </Link>
            <Link
              href="/interviews"
              className="tf-num rounded-full bg-[#eef4fe] px-2.5 py-[3px] text-[11.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              {ws.interviews.length} scheduled
            </Link>
          </div>
          {upcoming.map((iv) => {
            const c = ws.byId.get(iv.candidate_id);
            const d = new Date(iv.scheduled_at);
            return (
              <Link
                href="/interviews"
                key={iv.id}
                className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[11px] last:border-0 hover:bg-[#f6f8fb]"
              >
                <div className="w-[46px] shrink-0 text-center">
                  <div className="text-[11px] font-bold text-[#2a6fdb]">
                    {format(d, "EEE")}
                  </div>
                  <div className="tf-num text-[11.5px] font-semibold text-[#8a94a6]">
                    {format(d, "HH:mm")}
                  </div>
                </div>
                <Avatar name={c?.name ?? "—"} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold">
                    {c?.name ?? "—"}
                  </div>
                  <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">
                    {c?.jobTitle ?? ""}
                  </div>
                </div>
                <TypePill type={typeLabelFromEnum(iv.type)} />
              </Link>
            );
          })}
          {upcoming.length === 0 && (
            <div className="py-6 text-center text-[12.5px] font-semibold text-[#a3acbd]">
              Nothing scheduled.
            </div>
          )}
        </div>
      </div>

      {/* activity + open roles */}
      <div className="mt-[18px] grid grid-cols-[1fr_1.55fr] gap-[18px]">
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
                      {!initial && ` to ${stageFromSlug(e.to_stage)}`}
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
                      (c) => c.job_id === j.id && c.stageKey !== "Not Joined",
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
