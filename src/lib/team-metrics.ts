import type { Workspace } from "@/lib/data";
import { stageFromSlug, stageIndex } from "@/lib/domain";

// One place that computes recruiter workload/performance, so the Recruiting Team
// page and the daily digest email always show the same numbers.
//
// Interview activity is measured by PIPELINE STAGE, not by rows in the
// `interviews` table: client HR usually runs the interview directly, so we
// rarely schedule one inside the ATS. A candidate counts as "reached interview"
// once they are moved to the "Interview" (client interview) stage or beyond.

export const STALL_DAYS = 10; // active candidate idle in a stage longer than this = "stalled"

const IDX_INTERVIEW = stageIndex("Interview"); // client-interview stage
const IDX_OFFER = stageIndex("Offered");
const IDX_NOT_JOINED = stageIndex("Not Joined");

// Interview stages a candidate can currently sit in (client + practical rounds).
const INTERVIEW_STAGE_KEYS = new Set(["Interview", "Practical Interview"]);

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
  interviewing: number; // active candidates currently at a client/practical interview stage
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

  // ---- Stage history (from stage_events) ----
  // peakIdx: the furthest positive stage a candidate ever reached (ignores the
  //   negative "Not Joined" terminal, so a post-interview rejection still counts
  //   as having reached interview).
  // enteredInterviewWk / enteredOfferWk: candidates who moved INTO the client
  //   interview / offer stage within the last 7 days.
  const peakIdx = new Map<string, number>();
  const enteredInterviewWk = new Set<string>();
  const enteredOfferWk = new Set<string>();
  for (const e of ws.events) {
    const key = stageFromSlug(e.to_stage);
    const idx = stageIndex(key);
    if (idx < 0 || idx === IDX_NOT_JOINED) continue;
    if (idx > (peakIdx.get(e.candidate_id) ?? -1)) peakIdx.set(e.candidate_id, idx);
    if (ms(e.created_at) >= weekAgo) {
      if (key === "Interview") enteredInterviewWk.add(e.candidate_id);
      if (key === "Offered") enteredOfferWk.add(e.candidate_id);
    }
  }
  // A candidate's effective peak also accounts for their current stage, in case
  // stage history is missing for older rows.
  const effPeak = (candId: string, currentKey: string) => {
    const cur = stageIndex(stageFromSlug(currentKey));
    const curPos = cur === IDX_NOT_JOINED ? -1 : cur;
    return Math.max(peakIdx.get(candId) ?? -1, curPos);
  };

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
    const interviewing = mine.filter((c) => INTERVIEW_STAGE_KEYS.has(c.stageKey)).length;
    const hires = owned.filter((c) => c.stageKey === "Joined").length;

    const week = {
      submitted: owned.filter((c) => ms(c.created_at) >= weekAgo).length,
      interviews: owned.filter((c) => enteredInterviewWk.has(c.id)).length,
      offers: owned.filter((c) => enteredOfferWk.has(c.id)).length,
      hires: owned.filter(
        (c) => c.stageKey === "Joined" && ms(c.entered_stage_at) >= weekAgo,
      ).length,
    };

    // Conversion over everyone this recruiter has handled, measured by how far
    // each candidate progressed in the pipeline (stage-based, not ATS interviews).
    const handled = owned.length;
    const reachedInterview = owned.filter((c) => effPeak(c.id, c.stage) >= IDX_INTERVIEW).length;
    const reachedOffer = owned.filter((c) => effPeak(c.id, c.stage) >= IDX_OFFER).length;
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
