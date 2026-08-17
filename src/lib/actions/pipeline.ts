"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PIPELINE, type StageOutcome } from "@/lib/pipeline";

type Result = { ok: boolean; error?: string; message?: string };
const refresh = () => revalidatePath("/", "layout");

// clientId === null  -> the Default pipeline
// clientId === <id>  -> that client's override
type Scope = string | null;

const OUTCOMES: StageOutcome[] = ["in_progress", "won", "lost"];

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "stage"
  );
}

// Rows for one scope (Default or a client), ordered.
async function scopeRows(sb: Awaited<ReturnType<typeof createClient>>, clientId: Scope) {
  let q = sb.from("pipeline_stages").select("*").order("position");
  q = clientId === null ? q.is("client_id", null) : q.eq("client_id", clientId);
  const { data } = await q;
  return (data ?? []) as {
    id: string;
    client_id: string | null;
    name: string;
    slug: string;
    position: number;
    color: string;
    outcome: StageOutcome;
  }[];
}

// How many candidates currently sit in a given stage slug within a scope.
// For a client scope, only that client's candidates; for Default, any candidate
// (conservative — prevents orphaning a stage some default-pipeline client uses).
async function candidatesInStage(
  sb: Awaited<ReturnType<typeof createClient>>,
  clientId: Scope,
  slug: string,
): Promise<number> {
  if (clientId === null) {
    const { count } = await sb
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("stage", slug);
    return count ?? 0;
  }
  const { count } = await sb
    .from("candidates")
    .select("id, jobs!inner(client_id)", { count: "exact", head: true })
    .eq("stage", slug)
    .eq("jobs.client_id", clientId);
  return count ?? 0;
}

export async function addPipelineStage(clientId: Scope, name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Stage name is empty" };
  const sb = await createClient();
  const rows = await scopeRows(sb, clientId);
  // Unique slug within the scope.
  const existing = new Set(rows.map((r) => r.slug));
  const base = slugify(clean);
  let slug = base;
  for (let i = 2; existing.has(slug); i++) slug = `${base}_${i}`;
  const position = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
  const { error } = await sb.from("pipeline_stages").insert({
    client_id: clientId,
    name: clean,
    slug,
    position,
    color: "#64748b",
    outcome: "in_progress",
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Stage added" };
}

export async function renamePipelineStage(id: string, name: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Stage name is empty" };
  const sb = await createClient();
  // Rename only — the slug stays stable so candidates already in this stage keep it.
  const { error } = await sb.from("pipeline_stages").update({ name: clean }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setPipelineStageColor(id: string, color: string): Promise<Result> {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: "Invalid color" };
  const sb = await createClient();
  const { error } = await sb.from("pipeline_stages").update({ color }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setPipelineStageOutcome(id: string, outcome: StageOutcome): Promise<Result> {
  if (!OUTCOMES.includes(outcome)) return { ok: false, error: "Invalid outcome" };
  const sb = await createClient();
  const { error } = await sb.from("pipeline_stages").update({ outcome }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function movePipelineStage(id: string, dir: "up" | "down"): Promise<Result> {
  const sb = await createClient();
  const { data: row } = await sb.from("pipeline_stages").select("*").eq("id", id).single();
  if (!row) return { ok: false, error: "Stage not found" };
  const rows = await scopeRows(sb, row.client_id);
  const idx = rows.findIndex((r) => r.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= rows.length) return { ok: true }; // already at the edge
  const a = rows[idx];
  const b = rows[swapIdx];
  // Swap positions.
  const { error: e1 } = await sb.from("pipeline_stages").update({ position: b.position }).eq("id", a.id);
  const { error: e2 } = await sb.from("pipeline_stages").update({ position: a.position }).eq("id", b.id);
  if (e1 || e2) return { ok: false, error: (e1 || e2)!.message };
  refresh();
  return { ok: true };
}

export async function deletePipelineStage(id: string): Promise<Result> {
  const sb = await createClient();
  const { data: row } = await sb.from("pipeline_stages").select("*").eq("id", id).single();
  if (!row) return { ok: false, error: "Stage not found" };
  const rows = await scopeRows(sb, row.client_id);
  if (rows.length <= 1) return { ok: false, error: "A pipeline needs at least one stage" };
  const used = await candidatesInStage(sb, row.client_id, row.slug);
  if (used > 0)
    return {
      ok: false,
      error: `${used} candidate${used === 1 ? " is" : "s are"} in "${row.name}". Move them first, then delete.`,
    };
  const { error } = await sb.from("pipeline_stages").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Stage removed" };
}

// Clone the Default pipeline into a client-specific override so it can diverge.
export async function customizeClientPipeline(clientId: string): Promise<Result> {
  if (!clientId) return { ok: false, error: "No client" };
  const sb = await createClient();
  const existing = await scopeRows(sb, clientId);
  if (existing.length) return { ok: true }; // already customized
  const def = await scopeRows(sb, null);
  const source = def.length ? def : DEFAULT_PIPELINE;
  const insert = source.map((s, i) => ({
    client_id: clientId,
    name: s.name,
    slug: s.slug,
    position: i,
    color: s.color,
    outcome: s.outcome,
  }));
  const { error } = await sb.from("pipeline_stages").insert(insert);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Client pipeline created — edit it below" };
}

// Drop a client's override so it falls back to Default. Blocked if any of the
// client's candidates sit in a stage the Default doesn't have (would orphan them).
export async function resetClientPipeline(clientId: string): Promise<Result> {
  if (!clientId) return { ok: false, error: "No client" };
  const sb = await createClient();
  const override = await scopeRows(sb, clientId);
  if (!override.length) return { ok: true };
  const def = await scopeRows(sb, null);
  const defaultSlugs = new Set((def.length ? def : DEFAULT_PIPELINE).map((s) => s.slug));
  for (const s of override) {
    if (defaultSlugs.has(s.slug)) continue;
    const used = await candidatesInStage(sb, clientId, s.slug);
    if (used > 0)
      return {
        ok: false,
        error: `${used} candidate${used === 1 ? " is" : "s are"} in "${s.name}", which the Default pipeline doesn't have. Move them first.`,
      };
  }
  const { error } = await sb.from("pipeline_stages").delete().eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Reset to the Default pipeline" };
}
