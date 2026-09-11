import { loadWorkspace } from "@/lib/data";
import { nextStageSlug } from "@/lib/pipeline-core";
import { Avatar, StageBadge } from "@/components/bits";
import { TalentAdvance } from "@/components/view-actions";

export default async function TalentPage() {
  const { ws } = await loadWorkspace();

  // The pre-submission bench: candidates still early in the pipeline — before the
  // "Client Submit" milestone (i.e. Sourced / Screening) — that are in progress
  // and not on hold. This is where career-site applicants land, so nobody gets
  // lost waiting to be screened or submitted.
  const stages = ws.pipeline.default;
  const submitPos =
    stages.find((s) => s.slug === "client_submit")?.position ??
    stages.find((s) => s.slug === "screening")?.position ??
    2;
  const nextNameOf = (slug: string) => {
    const n = nextStageSlug(stages, slug);
    return n ? (stages.find((s) => s.slug === n)?.name ?? n) : null;
  };

  const pool = ws.candidates
    .filter(
      (c) => c.stageOutcome === "in_progress" && !c.on_hold && c.stagePosition < submitPos,
    )
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 text-[12.5px] font-semibold text-[#8a94a6]">
        {pool.length} candidate{pool.length === 1 ? "" : "s"} not yet submitted to a client — screen
        them and move them forward.
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {pool.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-[#e9edf3] bg-white p-[18px]"
          >
            <div className="flex items-center gap-3">
              <Avatar name={c.name} size={42} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold">{c.name}</div>
                <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">
                  {c.jobTitle}
                </div>
              </div>
              <span className="tf-num flex items-center gap-[3px] text-[11px] font-extrabold text-[#b27400]">
                ★ {c.rating.toFixed(1)}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <StageBadge stage={c.stageKey} name={c.stageName} color={c.stageColor} />
            </div>
            <div className="mt-2.5 text-[12px] font-medium text-[#5a6573]">
              {c.exp_years}y exp · {c.location} · via {c.source}
            </div>
            <div className="mt-[11px] flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-[#eef2f8] px-2 py-[3px] text-[10.5px] font-semibold text-[#556680]"
                >
                  {t}
                </span>
              ))}
            </div>
            <TalentAdvance id={c.id} nextLabel={nextNameOf(c.stage)} />
          </div>
        ))}
        {pool.length === 0 && (
          <div className="col-span-3 py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
            Nobody waiting — every candidate has been submitted or moved forward.
          </div>
        )}
      </div>
    </div>
  );
}
