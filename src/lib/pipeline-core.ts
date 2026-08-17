// Client-safe pipeline logic — types, the built-in default, the resolver and
// list helpers. NO server imports here, so both Server Components and
// "use client" components can import it. The DB loader lives in ./pipeline.

import { STAGES } from "@/lib/domain";

export type StageOutcome = "in_progress" | "won" | "lost";

export type PipelineStage = {
  id: string;
  clientId: string | null;
  name: string;
  slug: string;
  position: number;
  color: string;
  outcome: StageOutcome;
};

// Row shape as stored in `pipeline_stages`.
export type PipelineStageRow = {
  id: string;
  client_id: string | null;
  name: string;
  slug: string;
  position: number;
  color: string;
  outcome: StageOutcome;
};

// The built-in default, used as a fallback when the DB hasn't been seeded yet
// (mirrors the old enum order). Real reads come from the table.
export const DEFAULT_PIPELINE: PipelineStage[] = STAGES.map((s, i) => ({
  id: `default-${s.slug}`,
  clientId: null,
  name: s.key,
  slug: s.slug,
  position: i,
  color: s.color,
  outcome: s.slug === "joined" ? "won" : s.slug === "not_joined" ? "lost" : "in_progress",
}));

export function rowToStage(r: PipelineStageRow): PipelineStage {
  return {
    id: r.id,
    clientId: r.client_id,
    name: r.name,
    slug: r.slug,
    position: r.position,
    color: r.color,
    outcome: r.outcome,
  };
}

const byPosition = (a: PipelineStage, b: PipelineStage) => a.position - b.position;

// A resolver over all pipeline_stages rows: gives the Default list and each
// client's effective list (override if present, else Default).
export type PipelineResolver = {
  default: PipelineStage[];
  clientIds: string[]; // clients that have an override
  forClient: (clientId: string | null | undefined) => PipelineStage[];
};

export function buildResolver(rows: PipelineStageRow[]): PipelineResolver {
  const stages = rows.map(rowToStage);
  const def = stages.filter((s) => s.clientId === null).sort(byPosition);
  const byClient = new Map<string, PipelineStage[]>();
  for (const s of stages) {
    if (s.clientId === null) continue;
    const arr = byClient.get(s.clientId) ?? [];
    arr.push(s);
    byClient.set(s.clientId, arr);
  }
  for (const [, arr] of byClient) arr.sort(byPosition);
  const fallback = def.length ? def : DEFAULT_PIPELINE;
  return {
    default: fallback,
    clientIds: [...byClient.keys()],
    forClient: (clientId) => (clientId && byClient.get(clientId)) || fallback,
  };
}

// ---- list helpers (operate on a resolved stage list) --------------------------
export const stageBySlug = (stages: PipelineStage[], slug: string) =>
  stages.find((s) => s.slug === slug);

export const stageName = (stages: PipelineStage[], slug: string) =>
  stageBySlug(stages, slug)?.name ?? slug;

export const stageColorOf = (stages: PipelineStage[], slug: string) =>
  stageBySlug(stages, slug)?.color ?? "#64748b";

export const isTerminalStage = (stages: PipelineStage[], slug: string) =>
  (stageBySlug(stages, slug)?.outcome ?? "in_progress") !== "in_progress";

// Next stage by position that isn't a "lost" outcome (null if none) — the
// forward path a candidate advances along.
export function nextStageSlug(stages: PipelineStage[], slug: string): string | null {
  const cur = stageBySlug(stages, slug);
  if (!cur) return null;
  const after = stages
    .filter((s) => s.position > cur.position && s.outcome !== "lost")
    .sort(byPosition);
  return after.length ? after[0].slug : null;
}
