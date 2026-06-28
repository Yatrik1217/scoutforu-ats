import { loadWorkspace } from "@/lib/data";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { ws } = await loadWorkspace();
  const recruiters = Array.from(
    new Set(ws.candidates.map((c) => c.recruiterName)),
  ).sort();

  return (
    <PipelineClient
      candidates={ws.candidates}
      jobs={ws.jobs.map((j) => ({ id: j.id, title: j.title }))}
      recruiters={recruiters}
      query={q ?? ""}
    />
  );
}
