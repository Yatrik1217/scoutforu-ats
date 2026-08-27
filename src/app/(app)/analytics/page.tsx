import Link from "next/link";
import {
  loadWorkspace,
  funnelCounts,
  avgTimeInStage,
  sourceCounts,
  offerAcceptRate,
  avgTimeToHireDays,
  stageCount,
} from "@/lib/data";
import {
  PIPELINE_STAGES,
  SOURCES,
  SOURCE_COLOR,
  hexA,
  stageToSlug,
} from "@/lib/domain";

export default async function AnalyticsPage() {
  const { ws } = await loadWorkspace();
  const counts = funnelCounts(ws.candidates);
  const fmax = Math.max(1, ...counts);
  const tis = avgTimeInStage(ws.events);
  const tisVals = PIPELINE_STAGES.map((s) => tis[s.key]);
  const tisMax = Math.max(1, ...tisVals);
  const velocity = tisVals.filter((v) => v > 0);
  const velAvg = velocity.length
    ? (velocity.reduce((a, b) => a + b, 0) / velocity.length).toFixed(1)
    : "—";
  const tth = avgTimeToHireDays(ws.events);
  const src = sourceCounts(ws.candidates);
  const srcMax = Math.max(1, ...SOURCES.map((s) => src[s] ?? 0));

  // Recruiter productivity: resumes the recruiter SOURCED vs applicants who came
  // in on their own via the CAREER site (kept separate — a self-application isn't
  // the recruiter's sourcing) vs SUBMITTED TO CLIENT (ever reached Client Submit).
  const submittedIds = new Set(
    ws.events.filter((e) => e.to_stage === "client_submit").map((e) => e.candidate_id),
  );
  const recMap = new Map<
    string,
    { sourced: number; career: number; submitted: number; color: string }
  >();
  for (const c of ws.candidates) {
    const name = c.recruiterName || "Unassigned";
    const r = recMap.get(name) ?? { sourced: 0, career: 0, submitted: 0, color: c.recruiterColor };
    if ((c.source ?? "") === "Career Site") r.career++;
    else r.sourced++;
    if (submittedIds.has(c.id)) r.submitted++;
    recMap.set(name, r);
  }
  const recruiterRows = [...recMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.submitted - a.submitted || b.sourced - a.sourced);
  const recMaxSourced = Math.max(1, ...recruiterRows.map((r) => r.sourced));

  const kpis = [
    { label: "Offer Accept Rate", value: `${offerAcceptRate(ws.candidates)}%`, delta: "+5% vs last qtr", tone: "pos", href: "/offers" },
    { label: "Avg Time-to-Hire", value: tth ? `${tth}d` : "—", delta: "-3d faster", tone: "pos", href: "/pipeline" },
    { label: "Pipeline Velocity", value: `${velAvg}d`, delta: "per stage", tone: "neutral", href: "/pipeline" },
    { label: "Total Hires (QTD)", value: stageCount(ws.candidates, "Joined"), delta: "+17%", tone: "pos", href: "/candidates" },
  ] as const;

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-[18px] grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="rounded-2xl border border-[#e9edf3] bg-white p-[18px] transition hover:border-[#cbd7ea] hover:shadow-[0_6px_20px_rgba(20,32,58,.08)]"
          >
            <div className="text-[12px] font-semibold text-[#8a94a6]">
              {k.label}
            </div>
            <div className="font-display tf-num mt-2 text-[28px] font-extrabold">
              {k.value}
            </div>
            <div
              className="tf-num mt-1 text-[12px] font-bold"
              style={{
                color:
                  k.tone === "neutral"
                    ? "#8a94a6"
                    : k.tone === "pos"
                      ? "#16a34a"
                      : "#ef4444",
              }}
            >
              {k.delta}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-[18px] text-[15.5px] font-extrabold">
            Source Effectiveness
          </div>
          {SOURCES.map((s) => (
            <Link
              key={s}
              href={`/candidates?source=${encodeURIComponent(s)}`}
              className="-mx-2 mb-[5px] flex items-center gap-3 rounded-[9px] px-2 py-1 hover:bg-[#f6f8fb]"
            >
              <div className="w-[90px] text-[12.5px] font-semibold text-[#42506b]">
                {s}
              </div>
              <div className="h-[22px] flex-1 overflow-hidden rounded-md bg-[#f1f4f9]">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${Math.max(6, ((src[s] ?? 0) / srcMax) * 100)}%`,
                    background: SOURCE_COLOR[s],
                  }}
                />
              </div>
              <div className="tf-num w-7 text-right text-[13px] font-extrabold">
                {src[s] ?? 0}
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-[18px] text-[15.5px] font-extrabold">
            Avg Time in Stage (days)
          </div>
          {PIPELINE_STAGES.map((s, i) => (
            <Link
              key={s.key}
              href={`/candidates?stage=${stageToSlug(s.key)}`}
              className="-mx-2 mb-[3px] flex items-center gap-3 rounded-[9px] px-2 py-1 hover:bg-[#f6f8fb]"
            >
              <div className="w-[130px] text-right text-[12px] font-semibold text-[#42506b]">
                {s.key}
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-[#f1f4f9]">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${(tisVals[i] / tisMax) * 100}%`,
                    background: `linear-gradient(90deg,${hexA(s.color, 0.8)},${s.color})`,
                  }}
                />
              </div>
              <div className="tf-num w-6 text-right text-[12.5px] font-extrabold">
                {tisVals[i]}
              </div>
            </Link>
          ))}
        </div>

        <div className="col-span-2 rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-[18px] text-[15.5px] font-extrabold">
            Conversion Funnel
          </div>
          <div className="flex h-[180px] items-end gap-2.5">
            {PIPELINE_STAGES.map((s, i) => (
              <Link
                key={s.key}
                href={`/candidates?stage=${stageToSlug(s.key)}`}
                className="flex h-full flex-1 flex-col items-center justify-end rounded-[9px] hover:bg-[#f6f8fb]"
              >
                <div className="tf-num mb-1.5 text-[13px] font-extrabold">
                  {counts[i]}
                </div>
                <div
                  className="w-full max-w-[46px] rounded-t-[7px]"
                  style={{
                    height: `${Math.max(6, (counts[i] / fmax) * 130)}px`,
                    background: `linear-gradient(180deg,${s.color},${hexA(s.color, 0.6)})`,
                  }}
                />
                <div className="mt-2 text-center text-[10px] font-semibold leading-tight text-[#8a94a6]">
                  {s.key}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="col-span-2 rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-1 text-[15.5px] font-extrabold">Recruiter Productivity</div>
          <div className="mb-4 text-[12px] text-[#8a94a6]">
            <b>Sourced</b> = resumes the recruiter added · <b className="text-[#8b5cf6]">Career</b> =
            applicants who applied themselves via the career site · <b>Submitted</b> = reached Client Submit.
          </div>
          <div className="grid grid-cols-[1.5fr_80px_80px_90px_1fr] items-center gap-2 border-b border-[#eef1f6] pb-2 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
            <div>Recruiter</div>
            <div className="text-center">Sourced</div>
            <div className="text-center">Career</div>
            <div className="text-center">Submitted</div>
            <div>Sourced volume</div>
          </div>
          {recruiterRows.map((r) => (
            <div
              key={r.name}
              className="grid grid-cols-[1.5fr_80px_80px_90px_1fr] items-center gap-2 border-b border-[#f4f6fa] py-2.5 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                  style={{ background: r.color }}
                >
                  {r.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="truncate text-[13px] font-bold text-[#16203a]">{r.name}</span>
              </div>
              <div className="tf-num text-center text-[14px] font-extrabold text-[#42506b]">{r.sourced || "—"}</div>
              <div className="tf-num text-center text-[14px] font-extrabold text-[#8b5cf6]">{r.career || "—"}</div>
              <div className="tf-num text-center text-[14px] font-extrabold text-[#2a6fdb]">
                {r.submitted || "—"}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-[#f1f4f9]">
                  <div
                    className="h-full rounded-full bg-[#2a6fdb]"
                    style={{ width: `${(r.sourced / recMaxSourced) * 100}%` }}
                  />
                </div>
                <span className="tf-num w-8 text-right text-[11px] font-bold text-[#8a94a6]">
                  {r.sourced}
                </span>
              </div>
            </div>
          ))}
          {recruiterRows.length === 0 && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#a3acbd]">
              No candidates yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
