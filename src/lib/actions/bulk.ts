"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { moveCandidateStage } from "@/lib/actions/mutations";
import { messageCandidate } from "@/lib/actions/candidate-message";

type Result = { ok: boolean; error?: string; message?: string };

// Move many candidates to a stage — reuses the per-candidate mover so stage
// events + approval logic stay consistent. RLS/ownership still applies per row.
export async function bulkMoveStage(ids: string[], stageSlug: string): Promise<Result> {
  if (!ids.length) return { ok: false, error: "Nothing selected." };
  let ok = 0;
  for (const id of ids) {
    const r = await moveCandidateStage(id, stageSlug);
    if (r.ok) ok++;
  }
  revalidatePath("/", "layout");
  return ok
    ? { ok: true, message: `Moved ${ok} of ${ids.length}` }
    : { ok: false, error: "Nothing moved (check your permissions)." };
}

// Reassign many candidates to a recruiter (admin only).
export async function bulkAssignRecruiter(ids: string[], recruiterId: string): Promise<Result> {
  if (!ids.length) return { ok: false, error: "Nothing selected." };
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = user
    ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (me?.role !== "master_admin")
    return { ok: false, error: "Only an admin can reassign candidates." };
  const { error } = await sb.from("candidates").update({ recruiter_id: recruiterId }).in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `Assigned ${ids.length} candidate(s)` };
}

// Email/SMS many candidates at once — loops the per-candidate sender, which fills
// {{name}} per candidate and logs each to their activity.
export async function bulkMessage(
  ids: string[],
  channel: "email" | "sms" | "both",
  subject: string,
  body: string,
): Promise<Result> {
  if (!ids.length) return { ok: false, error: "Nothing selected." };
  let ok = 0;
  let firstErr = "";
  for (const id of ids) {
    const r = await messageCandidate({ candidateId: id, channel, subject, body });
    if (r.ok) ok++;
    else if (!firstErr) firstErr = r.error ?? "";
  }
  revalidatePath("/", "layout");
  return ok
    ? { ok: true, message: `Sent to ${ok} of ${ids.length}` }
    : { ok: false, error: firstErr || "Nothing sent." };
}
