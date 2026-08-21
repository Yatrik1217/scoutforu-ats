import { loadWorkspace } from "@/lib/data";
import { loadPipelines } from "@/lib/pipeline";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; job?: string }>;
}) {
  const { q, job } = await searchParams;
  const { ws } = await loadWorkspace();
  const pipelines = await loadPipelines();
  // Opening the board scoped to one job (from the Jobs page) pre-selects that
  // job so only its candidates show, in that client's pipeline.
  const initialJob = job && ws.jobs.some((j) => j.id === job) ? job : "all";

  const recruiters = Array.from(
    new Set(ws.candidates.map((c) => c.recruiterName)),
  ).sort();

  // Only ship the client overrides that actually exist (keeps the payload small).
  const clientStages: Record<string, typeof pipelines.default> = {};
  for (const cid of pipelines.clientIds) clientStages[cid] = pipelines.forClient(cid);

  return (
    <PipelineClient
      candidates={ws.candidates}
      jobs={ws.jobs.map((j) => ({ id: j.id, title: j.title, clientId: j.client_id }))}
      recruiters={recruiters}
      query={q ?? ""}
      initialJob={initialJob}
      defaultStages={pipelines.default}
      clientStages={clientStages}
    />
  );
}
