// Server-side pipeline loader. Re-exports the client-safe core so existing
// imports from "@/lib/pipeline" keep working; the DB read lives here because it
// needs the server Supabase client.

import { createClient } from "@/lib/supabase/server";
import { buildResolver, type PipelineStageRow } from "@/lib/pipeline-core";

export * from "@/lib/pipeline-core";

// Load every pipeline row and return a resolver. Falls back to the built-in
// default if the table is missing/empty so the app never renders zero columns.
export async function loadPipelines() {
  try {
    const sb = await createClient();
    const { data, error } = await sb
      .from("pipeline_stages")
      .select("*")
      .order("position");
    if (error || !data) return buildResolver([]);
    return buildResolver(data as PipelineStageRow[]);
  } catch {
    return buildResolver([]);
  }
}
