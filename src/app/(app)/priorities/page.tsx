import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Clock, AlertTriangle } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { recruiterMetrics } from "@/lib/team-metrics";
import { Avatar } from "@/components/bits";
import { ArrowRight } from "lucide-react";
import { CriticalToggle, AssignRecruiterSelect } from "@/components/priorities-actions";

const LEVEL = {
  High: { bg: "#fdecec", fg: "#dc2626" },
  Medium: { bg: "#fff5e6", fg: "#b45309" },
  Low: { bg: "#eef4fe", fg: "#2a6fdb" },
} as const;

export default async function PrioritiesPage() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");

  const stages = ws.pipeline.default;
  const submitPos =
    stages.find((s) => s.slug === "client_submit")?.position ??
    (stages.find((s) => s.slug === "screening")?.position ?? 1) + 1;
  const clientName = (id: string | null) =>
    id ? (ws.clients.find((c) => c.id === id)?.name ?? null) : null;

  const now = new Date().getTime();
  const day = 86_400_000;

  // Rank every open role by a transparent priority score.
  const ranked = ws.jobs
    .filter((j) => j.status !== "closed")
    .map((j) => {
      const cands = ws.candidates.filter((c) => c.job_id === j.id);
      const activeCands = cands.filter((c) => c.stageOutcome === "in_progress" && !c.on_hold);
      const active = activeCands.length;
      // "submitted to client" = reached the Client Submit stage or beyond (not lost).
      const submitted = cands.filter(
        (c) => c.stageOutcome !== "lost" && c.stagePosition >= submitPos,
      ).length;
      const readyToSubmit = activeCands.filter((c) => c.stagePosition < submitPos).length;
      const stalledSubmitted = activeCands.filter((c) => c.stagePosition >= submitPos && c.days > 10).length;
      const inInterview = activeCands.filter((c) => c.stageIsInterview).length;
      const critical = !!j.is_critical;

      // The concrete next step for this role.
      const action =
        active === 0
          ? { label: "Source candidates", tone: "red" as const }
          : readyToSubmit > 0
            ? { label: `Submit ${readyToSubmit} to client`, tone: "amber" as const }
            : stalledSubmitted > 0
              ? { label: "Chase client", tone: "blue" as const }
              : inInterview > 0
                ? { label: "Push interviews", tone: "blue" as const }
                : { label: "Review pipeline", tone: "muted" as const };
      const daysOpen = Math.max(0, Math.floor((now - +new Date(j.posted_at)) / day));
      const overdue = j.target_date
        ? Math.floor((now - +new Date(j.target_date)) / day)
        : null;
      const hot = j.status === "hot";

      let score = Math.min(daysOpen, 60); // aging (cap 60)
      const reasons: { label: string; tone: "red" | "amber" | "muted" }[] = [
        { label: `${daysOpen}d open`, tone: daysOpen > 30 ? "amber" : "muted" },
      ];
      if (submitted === 0) {
        score += 40;
        reasons.push({ label: "0 submitted", tone: "red" });
      } else {
        score += Math.max(0, 20 - submitted * 5);
        reasons.push({ label: `${submitted} submitted`, tone: "muted" });
      }
      if (hot) {
        score += 30;
        reasons.push({ label: "Hot", tone: "red" });
      }
      if (overdue !== null && overdue > 0) {
        score += 30;
        reasons.push({ label: `Overdue ${overdue}d`, tone: "red" });
      } else if (overdue !== null && overdue >= -7) {
        score += 15;
        reasons.push({ label: "Due soon", tone: "amber" });
      }
      if (active === 0) {
        score += 25;
        reasons.push({ label: "No pipeline", tone: "red" });
      } else if (active < 3) {
        score += 10;
        reasons.push({ label: `${active} in pipeline`, tone: "amber" });
      }

      if (critical) {
        score += 1000; // pinned to the top by the admin
        reasons.unshift({ label: "Critical", tone: "red" });
      }
      const level = critical || score >= 80 ? "High" : score >= 45 ? "Medium" : "Low";
      return {
        id: j.id,
        title: j.title,
        dept: j.dept,
        client: clientName(j.client_id),
        openings: j.openings,
        daysOpen,
        submitted,
        active,
        level: level as keyof typeof LEVEL,
        critical,
        action,
        score,
        reasons,
        recId: j.recruiter_id,
      };
    })
    .sort((a, b) => b.score - a.score);

  const recruiterOpts = ws.team
    .filter((p) => p.role === "recruiter")
    .map((p) => ({ id: p.id, name: p.name }));

  const highCount = ranked.filter((r) => r.level === "High").length;

  // Recruiter load (same numbers as the Recruiting Team page).
  const load = recruiterMetrics(ws)
    .map((m) => ({ ...m, pct: Math.min(100, Math.round((m.active / 8) * 100)) }))
    .sort((a, b) => b.active - a.active);

  const asOf = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  });

  const toneCls = (t: "red" | "amber" | "muted" | "blue") =>
    t === "red"
      ? "bg-[#fdecec] text-[#dc2626]"
      : t === "amber"
        ? "bg-[#fff5e6] text-[#b45309]"
        : t === "blue"
          ? "bg-[#eef4fe] text-[#2a6fdb]"
          : "bg-[#eef1f6] text-[#7a8696]";

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[12.5px] font-semibold text-[#8a94a6]">
          {asOf} · {ranked.length} open role{ranked.length === 1 ? "" : "s"} ·{" "}
          <span className="font-bold text-[#dc2626]">{highCount} high priority</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1.7fr_1fr]">
        {/* Priority roles */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-1 text-[15.5px] font-extrabold">Roles to push this week</div>
          <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">
            Ranked by days open, submissions to client, criticality &amp; sourcing gap
          </div>
          <div className="flex flex-col">
            {ranked.map((r, i) => (
              <div
                key={r.id}
                className="flex items-start gap-3 border-t border-[#f0f3f8] py-3 first:border-0"
              >
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
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${toneCls(r.action.tone)}`}
                    >
                      <ArrowRight size={11} strokeWidth={2.6} /> {r.action.label}
                    </span>
                    {r.reasons.map((x, k) => (
                      <span
                        key={k}
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${toneCls(x.tone)}`}
                      >
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
              const bar = m.pct > 80 ? "#ef4444" : m.pct > 55 ? "#f59e0b" : "#16a34a";
              return (
                <Link
                  key={m.id}
                  href="/team"
                  className="rounded-[13px] border border-[#eef1f6] bg-[#fafbfe] p-[12px_14px] transition hover:border-[#c9d6ee]"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size={34} />
                    <div className="flex-1">
                      <div className="text-[13.5px] font-bold text-[#16203a]">{m.name}</div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8a94a6]">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {m.active} active
                        </span>
                        <span>· {m.openings.length} openings</span>
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
                      <div className="h-full rounded" style={{ width: `${m.pct}%`, background: bar }} />
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
            <Flame size={12} className="mt-0.5 shrink-0" /> Assign the red/high roles above to whoever is greenest here.
          </div>
        </div>
      </div>
    </div>
  );
}
