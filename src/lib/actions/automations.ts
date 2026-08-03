"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string; message?: string };

// Admin: set (or clear) the auto-email rule for a pipeline stage.
export async function saveStageEmailRule(
  stage: string,
  templateId: string | null,
  enabled: boolean,
): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = user
    ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (me?.role !== "master_admin") return { ok: false, error: "Admins only." };

  const { error } = await sb.from("stage_email_rules").upsert(
    { stage, template_id: templateId, enabled, updated_at: new Date().toISOString() },
    { onConflict: "stage" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved" };
}
