import type { Workspace } from "@/lib/data";

// One place that computes recruiter workload/performance, so the Recruiting Team
// page and the daily digest email always show the same numbers.

export const STALL_DAYS = 10; // active candidate idle in a stage longer than this = "stalled"

export type OpeningMetric = {
  jobId: string;
  title: string;
  dept: string;
  clientName: string | null;
  status: "open" | "hot" | "closed";
  active: number;
  stalled: number;
  stages: { name: string; n: number }[];
};

export type RecruiterMetric = {
  id: string;
  name: string;
  isActive: boolean;
  active: number;
  stalled: number;
  interviews: number; // interviews where this person is the interviewer (matches the tile)
  hires: number;
  week: { submitted: number; interviews: number; offers: number; hires: number };
  conv: { handled: number; interviewPct: number; offerPct: number; hirePct: number };
  openings: OpeningMetric[];
};

export function recruiterMetrics(ws: Workspace): RecruiterMetric[] {
  const recruiters = ws.team.filter((p) => p.role === "recruiter");
  const clientName = (id: string | null) =>
    id ? (ws.clients.find((c) => c.id === id)?.name ?? null) : null;

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

  return recruiters.map((t) => {
    const owned = ws.candidates.filter((c) => c.recruiter_id === t.id);
    const ownedIds = new Set(owned.map((c) => c.id));
    const mine = owned.filter(
      (c) => c.stageKey !== "Joined" && c.stageKey !== "Not Joined",
    );

    // Openings, credited by the submitting recruiter (works for shared reqs).
    const byJob = new Map<string, OpeningMetric & { _stages: Map<string, number> }>();
    for (const c of mine) {
      const jid = c.job_id ?? "__none__";
      const job = c.job_id ? ws.jobById.get(c.job_id) : undefined;
      const e =
        byJob.get(jid) ??
        ({
          jobId: jid,
          title: job?.title ?? c.jobTitle ?? "Unassigned opening",
          dept: job?.dept ?? "",
          clientName: clientName(job?.client_id ?? null),
          status: (job?.status ?? "open") as OpeningMetric["status"],
          active: 0,
          stalled: 0,
          stages: [],
          _stages: new Map<string, number>(),
        } as OpeningMetric & { _stages: Map<string, number> });
      e.active += 1;
      if (c.days > STALL_DAYS) e.stalled += 1;
      e._stages.set(c.stageKey, (e._stages.get(c.stageKey) ?? 0) + 1);
      byJob.set(jid, e);
    }

    const openings: OpeningMetric[] = [...byJob.values()]
      .map((e) => ({
        jobId: e.jobId,
        title: e.title,
        dept: e.dept,
        clientName: e.clientName,
        status: e.status,
        active: e.active,
        stalled: e.stalled,
        stages: [...e._stages.entries()]
          .map(([name, n]) => ({ name, n }))
          .sort((a, b) => b.n - a.n),
      }))
      .sort((a, b) => b.active - a.active || a.title.localeCompare(b.title));

    const active = mine.length;
    const stalled = mine.filter((c) => c.days > STALL_DAYS).length;
    const interviews = ws.interviews.filter((i) => i.interviewer_id === t.id).length;
    const hires = owned.filter((c) => c.stageKey === "Joined").length;

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

    const interviewedIds = new Set(
      ws.interviews.filter((i) => ownedIds.has(i.candidate_id)).map((i) => i.candidate_id),
    );
    const offeredIds = new Set(
      ws.offers.filter((o) => ownedIds.has(o.candidate_id)).map((o) => o.candidate_id),
    );
    const handled = owned.length;
    const rate = (n: number) => (handled ? Math.round((n / handled) * 100) : 0);

    return {
      id: t.id,
      name: t.name,
      isActive: !!t.active,
      active,
      stalled,
      interviews,
      hires,
      week,
      conv: {
        handled,
        interviewPct: rate(interviewedIds.size),
        offerPct: rate(offeredIds.size),
        hirePct: rate(hires),
      },
      openings,
    };
  });
}
