import type { Workspace } from "@/lib/data";
import { recruiterMetrics } from "@/lib/team-metrics";

export type Reason = { label: string; tone: "red" | "amber" | "muted" | "blue" };
export type Seniority = "senior" | "mid" | "junior";

export type PriorityRole = {
  id: string;
  title: string;
  dept: string;
  client: string | null;
  openings: number;
  daysOpen: number;
  submitted: number;
  active: number;
  level: "High" | "Medium" | "Low";
  critical: boolean;
  seniority: Seniority;
  action: { label: string; tone: Reason["tone"] };
  score: number;
  reasons: Reason[];
  recId: string | null;
};

export type RecruiterLoad = {
  id: string;
  name: string;
  active: number;
  openings: number;
  stalled: number;
  hirePct: number;
  offerPct: number;
  pct: number; // capacity vs a nominal load of 8 active
  overloaded: boolean;
};

const SENIOR_RE = /senior|\bsr\.?\b|lead|principal|architect|\bhead\b|manager|director|\bvp\b|chief|staff/i;
const JUNIOR_RE = /junior|\bjr\.?\b|trainee|intern|fresher|associate|entry|graduate/i;

export function roleSeniority(title: string, designation: string, expMin: number): Seniority {
  const t = `${title} ${designation}`;
  if (SENIOR_RE.test(t) || expMin >= 6) return "senior";
  if (JUNIOR_RE.test(t) || (expMin > 0 && expMin <= 2)) return "junior";
  return "mid";
}

// Rank every open role by a transparent priority score: days open + submissions
// to client + criticality (hot / overdue / manual flag) + sourcing gap.
export function rankRoles(ws: Workspace): PriorityRole[] {
  const stages = ws.pipeline.default;
  const submitPos =
    stages.find((s) => s.slug === "client_submit")?.position ??
    (stages.find((s) => s.slug === "screening")?.position ?? 1) + 1;
  const clientName = (id: string | null) =>
    id ? (ws.clients.find((c) => c.id === id)?.name ?? null) : null;
  const now = new Date().getTime();
  const day = 86_400_000;

  return ws.jobs
    .filter((j) => j.status !== "closed")
    .map((j) => {
      const cands = ws.candidates.filter((c) => c.job_id === j.id);
      const activeCands = cands.filter((c) => c.stageOutcome === "in_progress" && !c.on_hold);
      const active = activeCands.length;
      const submitted = cands.filter(
        (c) => c.stageOutcome !== "lost" && c.stagePosition >= submitPos,
      ).length;
      const readyToSubmit = activeCands.filter((c) => c.stagePosition < submitPos).length;
      const stalledSubmitted = activeCands.filter((c) => c.stagePosition >= submitPos && c.days > 10).length;
      const inInterview = activeCands.filter((c) => c.stageIsInterview).length;
      const critical = !!j.is_critical;
      const daysOpen = Math.max(0, Math.floor((now - +new Date(j.posted_at)) / day));
      const overdue = j.target_date ? Math.floor((now - +new Date(j.target_date)) / day) : null;
      const hot = j.status === "hot";

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

      let score = Math.min(daysOpen, 60);
      const reasons: Reason[] = [{ label: `${daysOpen}d open`, tone: daysOpen > 30 ? "amber" : "muted" }];
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
        score += 1000;
        reasons.unshift({ label: "Critical", tone: "red" });
      }

      const level: PriorityRole["level"] =
        critical || score >= 80 ? "High" : score >= 45 ? "Medium" : "Low";
      return {
        id: j.id,
        title: j.title,
        dept: j.dept,
        client: clientName(j.client_id),
        openings: j.openings,
        daysOpen,
        submitted,
        active,
        level,
        critical,
        seniority: roleSeniority(j.title, j.designation, j.exp_min),
        action,
        score,
        reasons,
        recId: j.recruiter_id,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function recruiterLoad(ws: Workspace): RecruiterLoad[] {
  return recruiterMetrics(ws)
    .map((m) => {
      const pct = Math.min(150, Math.round((m.active / 8) * 100));
      return {
        id: m.id,
        name: m.name,
        active: m.active,
        openings: m.openings.length,
        stalled: m.stalled,
        hirePct: m.conv.hirePct,
        offerPct: m.conv.offerPct,
        pct,
        overloaded: pct >= 90,
      };
    })
    .sort((a, b) => b.active - a.active);
}

// Recommend who should take a role: senior/critical → best track record among
// those with room; junior/mid → whoever has the most capacity.
export function recommendRecruiter(
  role: Pick<PriorityRole, "seniority" | "critical">,
  load: RecruiterLoad[],
): { rec: RecruiterLoad; reason: string } | null {
  if (!load.length) return null;
  const withRoom = load.filter((r) => !r.overloaded);
  const pool = withRoom.length ? withRoom : load;
  if (role.seniority === "senior" || role.critical) {
    const rec = [...pool].sort((a, b) => b.hirePct - a.hirePct || a.active - b.active)[0];
    return { rec, reason: withRoom.length ? "strong track record + room" : "strongest track record" };
  }
  const rec = [...pool].sort((a, b) => a.active - b.active)[0];
  return { rec, reason: "most capacity" };
}

// One-glance weekly advice: which unassigned/High roles to route where, who's
// overloaded, and whether the team is at capacity (needs a hire).
export function weeklyAdvice(ranked: PriorityRole[], load: RecruiterLoad[]) {
  const overloaded = load.filter((r) => r.overloaded);
  const needAssign = ranked.filter(
    (r) => (r.level === "High" || r.critical) && (!r.recId || load.find((l) => l.id === r.recId)?.overloaded),
  );
  const picks = needAssign
    .slice(0, 5)
    .map((role) => {
      const rec = recommendRecruiter(role, load);
      return rec ? { role, rec: rec.rec, reason: rec.reason } : null;
    })
    .filter((x): x is { role: PriorityRole; rec: RecruiterLoad; reason: string } => !!x);
  const needHire = load.length > 0 && load.every((r) => r.overloaded) && needAssign.length > 0;
  return { overloaded, picks, needHire };
}
