import type { Workspace } from "@/lib/data";
import { isInterviewStage } from "@/lib/pipeline-core";

// One place that computes recruiter workload/performance, so the Recruiting Team
// page and the daily digest email always show the same numbers.
//
// Everything is classified by the candidate's ACTUAL pipeline stage (resolved in
// getWorkspace), never the canonical 9-stage map — custom stages like
// "Rejected" or "1st Technical Round" otherwise collapse to "Sourced".
// Interview activity is read from the stage (client HR runs interviews; the ATS
// rarely has an interview row), and active excludes won/lost + on-hold.

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
  interviewing: number; // active candidates currently at a client/technical interview stage
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

  // ---- Pipeline geometry (from the resolved Default set) ----
  const stagesDef = ws.pipeline.default;
  const posOf = new Map(stagesDef.map((s) => [s.slug, s.position]));
  const outcomeOf = new Map(stagesDef.map((s) => [s.slug, s.outcome]));
  const interviewSlugs = new Set(
    stagesDef.filter((s) => isInterviewStage(s)).map((s) => s.slug),
  );
  const interviewPositions = stagesDef
    .filter((s) => isInterviewStage(s))
    .map((s) => s.position);
  const minInterviewPos = interviewPositions.length ? Math.min(...interviewPositions) : Infinity;
  const offerPos = stagesDef.find((s) => s.slug === "offered")?.position ?? Infinity;

  // Furthest positive stage each candidate ever reached (ignores lost stages so
  // a post-interview rejection still counts as "reached interview").
  const peakPos = new Map<string, number>();
  const enteredInterviewWk = new Set<string>();
  const enteredOfferWk = new Set<string>();
  for (const e of ws.events) {
    const oc = outcomeOf.get(e.to_stage);
    const p = posOf.get(e.to_stage);
    if (oc && oc !== "lost" && p != null && p > (peakPos.get(e.candidate_id) ?? -1)) {
      peakPos.set(e.candidate_id, p);
    }
    if (ms(e.created_at) >= weekAgo) {
      if (interviewSlugs.has(e.to_stage)) enteredInterviewWk.add(e.candidate_id);
      if (e.to_stage === "offered") enteredOfferWk.add(e.candidate_id);
    }
  }

  return recruiters.map((t) => {
    const owned = ws.candidates.filter((c) => c.recruiter_id === t.id);

    // Active pipeline: in-progress outcome, not parked on hold.
    const mine = owned.filter((c) => c.stageOutcome === "in_progress" && !c.on_hold);

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
      e._stages.set(c.stageName, (e._stages.get(c.stageName) ?? 0) + 1);
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
    const interviewing = mine.filter((c) => c.stageIsInterview).length;
    const hires = owned.filter((c) => c.stageOutcome === "won").length;

    const week = {
      submitted: owned.filter((c) => ms(c.created_at) >= weekAgo).length,
      interviews: owned.filter((c) => enteredInterviewWk.has(c.id)).length,
      offers: owned.filter((c) => enteredOfferWk.has(c.id)).length,
      hires: owned.filter(
        (c) => c.stageOutcome === "won" && ms(c.entered_stage_at) >= weekAgo,
      ).length,
    };

    // Conversion over everyone handled, by furthest pipeline stage reached.
    const effPeak = (c: (typeof owned)[number]) =>
      Math.max(peakPos.get(c.id) ?? -1, c.stageOutcome === "lost" ? -1 : c.stagePosition);
    const handled = owned.length;
    const reachedInterview = owned.filter((c) => effPeak(c) >= minInterviewPos).length;
    const reachedOffer = owned.filter((c) => effPeak(c) >= offerPos).length;
    const rate = (n: number) => (handled ? Math.round((n / handled) * 100) : 0);

    return {
      id: t.id,
      name: t.name,
      isActive: !!t.active,
      active,
      stalled,
      interviewing,
      hires,
      week,
      conv: {
        handled,
        interviewPct: rate(reachedInterview),
        offerPct: rate(reachedOffer),
        hirePct: rate(hires),
      },
      openings,
    };
  });
}
