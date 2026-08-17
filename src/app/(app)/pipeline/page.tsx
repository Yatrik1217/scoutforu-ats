import { loadWorkspace } from "@/lib/data";
import { loadPipelines } from "@/lib/pipeline";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { ws } = await loadWorkspace();
  const pipelines = await loadPipelines();

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
      defaultStages={pipelines.default}
      clientStages={clientStages}
    />
  );
}
