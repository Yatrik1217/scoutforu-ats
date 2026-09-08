import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { TeamBoard, type RecruiterCard, type OpeningBreakdown } from "@/components/team-board";

const STALL_DAYS = 10; // active candidate idle in a stage longer than this = "stalled"

export default async function TeamPage() {
  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/overview");
  const recruiters = ws.team.filter((p) => p.role === "recruiter");
  const clientName = (id: string | null) =>
    id ? (ws.clients.find((c) => c.id === id)?.name ?? null) : null;

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  const cards: RecruiterCard[] = recruiters.map((t) => {
    // Every candidate this recruiter has ever owned (submitted).
    const owned = ws.candidates.filter((c) => c.recruiter_id === t.id);
    const ownedIds = new Set(owned.map((c) => c.id));

    // Active pipeline (same definition as the "Active" tile).
    const mine = owned.filter(
      (c) => c.stageKey !== "Joined" && c.stageKey !== "Not Joined",
    );

    // Group the active pipeline by opening (job). Counts sum to activeCount.
    const byJob = new Map<
      string,
      {
        title: string;
        dept: string;
        clientName: string | null;
        status: OpeningBreakdown["status"];
        active: number;
        stalled: number;
        stages: Map<string, number>;
      }
    >();
    for (const c of mine) {
      const jid = c.job_id ?? "__none__";
      const job = c.job_id ? ws.jobById.get(c.job_id) : undefined;
      const e =
        byJob.get(jid) ??
        {
          title: job?.title ?? c.jobTitle ?? "Unassigned opening",
          dept: job?.dept ?? "",
          clientName: clientName(job?.client_id ?? null),
          status: (job?.status ?? "open") as OpeningBreakdown["status"],
          active: 0,
          stalled: 0,
          stages: new Map<string, number>(),
        };
      e.active += 1;
      if (c.days > STALL_DAYS) e.stalled += 1;
      e.stages.set(c.stageKey, (e.stages.get(c.stageKey) ?? 0) + 1);
      byJob.set(jid, e);
    }

    // An opening is credited to whoever submitted the candidate — so on a shared
    // requisition each recruiter sees that opening scoped to their own submissions.

    const openings: OpeningBreakdown[] = [...byJob.entries()]
      .map(([jobId, e]) => ({
        jobId,
        title: e.title,
        dept: e.dept,
        clientName: e.clientName,
        status: e.status,
        active: e.active,
        stalled: e.stalled,
        stages: [...e.stages.entries()]
          .map(([name, n]) => ({ name, n }))
          .sort((a, b) => b.n - a.n),
      }))
      .sort((a, b) => b.active - a.active || a.title.localeCompare(b.title));

    const activeCount = mine.length;
    const stalledCount = mine.filter((c) => c.days > STALL_DAYS).length;
    const interviews = ws.interviews.filter((i) => i.interviewer_id === t.id).length;
    const hires = owned.filter((c) => c.stageKey === "Joined").length;
    const pct = Math.min(100, Math.round((activeCount / 8) * 100));
    const barColor = pct > 80 ? "#ef4444" : pct > 55 ? "#f59e0b" : "#16a34a";

    // ---- This week (last 7 days) ----
    const week = {
      submitted: owned.filter((c) => ms(c.created_at) >= weekAgo).length,
      interviews: ws.interviews.filter(
        (i) => ownedIds.has(i.candidate_id) && ms(i.created_at) >= weekAgo,
      ).length,
      offers: ws.offers.filter(
        (o) => ownedIds.has(o.candidate_id) && ms(o.sent_at) >= weekAgo,
      ).length,
      hires: owned.filter(
        (c) => c.stageKey === "Joined" && ms(c.entered_stage_at) >= weekAgo,
      ).length,
    };

    // ---- Conversion (all-time, over everyone this recruiter has handled) ----
    const interviewedIds = new Set(
      ws.interviews.filter((i) => ownedIds.has(i.candidate_id)).map((i) => i.candidate_id),
    );
    const offeredIds = new Set(
      ws.offers.filter((o) => ownedIds.has(o.candidate_id)).map((o) => o.candidate_id),
    );
    const handled = owned.length;
    const rate = (n: number) => (handled ? Math.round((n / handled) * 100) : 0);
    const conv = {
      handled,
      interviewPct: rate(interviewedIds.size),
      offerPct: rate(offeredIds.size),
      hirePct: rate(hires),
    };

    return {
      id: t.id,
      name: t.name,
      isActive: !!t.active,
      activeCount,
      stalledCount,
      interviews,
      hires,
      pct,
      barColor,
      openings,
      week,
      conv,
    };
  });

  const asOf = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <TeamBoard recruiters={cards} asOf={asOf} stallDays={STALL_DAYS} />
    </div>
  );
}
