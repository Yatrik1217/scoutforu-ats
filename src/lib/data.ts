import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getEffectiveScope, type EffectiveScope } from "@/lib/preview";
import type {
  CandidateRow,
  ClientRow,
  InterviewRow,
  JobRow,
  OfferRow,
  ProfileRow,
  StageEventRow,
  AppSettingsRow,
} from "@/lib/database.types";
import {
  STAGES,
  PIPELINE_STAGES,
  stageFromSlug,
  daysInStage,
  type StageKey,
} from "@/lib/domain";

export type EnrichedCandidate = CandidateRow & {
  stageKey: StageKey;
  jobTitle: string;
  jobDept: string;
  clientId: string | null;
  recruiterName: string;
  recruiterColor: string;
  days: number;
};

export type Workspace = {
  clients: ClientRow[];
  jobs: JobRow[];
  team: ProfileRow[];
  candidates: EnrichedCandidate[];
  interviews: InterviewRow[];
  offers: OfferRow[];
  events: StageEventRow[];
  settings: AppSettingsRow | null;
  byId: Map<string, EnrichedCandidate>;
  jobById: Map<string, JobRow>;
  profileById: Map<string, ProfileRow>;
};

export async function getWorkspace(scope: EffectiveScope): Promise<Workspace> {
  const sb = await createClient();
  const [clients, jobs, team, candidates, interviews, offers, events, settings] =
    await Promise.all([
      sb.from("clients").select("*").order("name"),
      sb.from("jobs").select("*").order("posted_at", { ascending: false }),
      sb.from("profiles").select("*"),
      sb.from("candidates").select("*"),
      sb.from("interviews").select("*").order("scheduled_at"),
      sb.from("offers").select("*"),
      sb
        .from("stage_events")
        .select("*")
        .order("created_at", { ascending: false }),
      sb.from("app_settings").select("*").maybeSingle(),
    ]);

  const profileById = new Map<string, ProfileRow>(
    (team.data ?? []).map((p) => [p.id, p]),
  );
  const jobById = new Map<string, JobRow>((jobs.data ?? []).map((j) => [j.id, j]));

  let jobRows = jobs.data ?? [];
  let candRows = candidates.data ?? [];
  let interviewRows = interviews.data ?? [];
  let offerRows = offers.data ?? [];
  let eventRows = events.data ?? [];

  // Apply preview-as-client narrowing in app code (RLS already enforces this
  // for real client logins; this also covers a Master Admin previewing).
  if (scope.role === "client" && scope.previewClientId) {
    const cid = scope.previewClientId;
    jobRows = jobRows.filter((j) => j.client_id === cid);
    const jobIds = new Set(jobRows.map((j) => j.id));
    candRows = candRows.filter((c) => c.job_id && jobIds.has(c.job_id));
    const candIds = new Set(candRows.map((c) => c.id));
    interviewRows = interviewRows.filter((i) => candIds.has(i.candidate_id));
    offerRows = offerRows.filter((o) => candIds.has(o.candidate_id));
    eventRows = eventRows.filter((e) => candIds.has(e.candidate_id));
  }

  const enriched: EnrichedCandidate[] = candRows.map((c) => {
    const job = c.job_id ? jobById.get(c.job_id) : undefined;
    const rec = c.recruiter_id ? profileById.get(c.recruiter_id) : undefined;
    return {
      ...c,
      stageKey: stageFromSlug(c.stage),
      jobTitle: job?.title ?? "—",
      jobDept: job?.dept ?? "",
      clientId: job?.client_id ?? null,
      recruiterName: rec?.name ?? "Unassigned",
      recruiterColor: rec?.color ?? "#64748b",
      days: daysInStage(c.entered_stage_at),
    };
  });

  return {
    clients: clients.data ?? [],
    jobs: jobRows,
    team: (team.data ?? []).filter((p) => p.role !== "client"),
    candidates: enriched,
    interviews: interviewRows,
    offers: offerRows,
    events: eventRows,
    settings: settings.data ?? null,
    byId: new Map(enriched.map((c) => [c.id, c])),
    jobById,
    profileById,
  };
}

// Convenience for pages: resolve scope + load the full workspace in one call.
export async function loadWorkspace(): Promise<{
  scope: EffectiveScope;
  ws: Workspace;
}> {
  const profile = await requireProfile();
  const sb = await createClient();
  const { data: clients } = await sb.from("clients").select("id,name");
  const scope = await getEffectiveScope(
    profile,
    (clients ?? []) as { id: string; name: string }[],
  );
  const ws = await getWorkspace(scope);
  return { scope, ws };
}

// ---- nav badge counts (cheap, for the shell) ----
export async function getNavCounts(): Promise<{
  jobs: number;
  interviews: number;
}> {
  const sb = await createClient();
  const [jobs, interviews] = await Promise.all([
    sb.from("jobs").select("id", { count: "exact", head: true }),
    sb.from("interviews").select("id", { count: "exact", head: true }),
  ]);
  return { jobs: jobs.count ?? 0, interviews: interviews.count ?? 0 };
}

// ---------- derived analytics (computed from candidates + events) ----------
export function funnelCounts(candidates: EnrichedCandidate[]) {
  return PIPELINE_STAGES.map(
    (s) => candidates.filter((c) => c.stageKey === s.key).length,
  );
}

export function stageCount(candidates: EnrichedCandidate[], key: StageKey) {
  return candidates.filter((c) => c.stageKey === key).length;
}

export function activeCount(candidates: EnrichedCandidate[]) {
  return candidates.filter(
    (c) => c.stageKey !== "Joined" && c.stageKey !== "Not Joined",
  ).length;
}

// Avg time in each stage (days) from consecutive stage events per candidate.
export function avgTimeInStage(
  events: StageEventRow[],
): Record<StageKey, number> {
  const byCand = new Map<string, StageEventRow[]>();
  for (const e of events) {
    const arr = byCand.get(e.candidate_id) ?? [];
    arr.push(e);
    byCand.set(e.candidate_id, arr);
  }
  const totals: Record<string, { sum: number; n: number }> = {};
  for (const arr of byCand.values()) {
    const sorted = [...arr].sort(
      (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const key = stageFromSlug(sorted[i].to_stage);
      const dur =
        (+new Date(sorted[i + 1].created_at) -
          +new Date(sorted[i].created_at)) /
        86_400_000;
      const t = (totals[key] ??= { sum: 0, n: 0 });
      t.sum += dur;
      t.n += 1;
    }
  }
  const out = {} as Record<StageKey, number>;
  for (const s of STAGES) {
    const t = totals[s.key];
    out[s.key] = t && t.n ? Math.round((t.sum / t.n) * 10) / 10 : 0;
  }
  return out;
}

export function sourceCounts(candidates: EnrichedCandidate[]) {
  const m: Record<string, number> = {};
  for (const c of candidates) if (c.source) m[c.source] = (m[c.source] ?? 0) + 1;
  return m;
}

export function avgTimeToHireDays(events: StageEventRow[]): number | null {
  const byCand = new Map<string, StageEventRow[]>();
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
    if (joined && sorted.length)
      durs.push(
        (+new Date(joined.created_at) - +new Date(sorted[0].created_at)) /
          86_400_000,
      );
  }
  return durs.length
    ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length)
    : null;
}

export function offerAcceptRate(candidates: EnrichedCandidate[]) {
  const offered = candidates.filter((c) =>
    ["Offered", "Offer Accepted", "Joined"].includes(c.stageKey),
  ).length;
  const accepted = candidates.filter((c) =>
    ["Offer Accepted", "Joined"].includes(c.stageKey),
  ).length;
  return offered ? Math.round((accepted / offered) * 100) : 0;
}
