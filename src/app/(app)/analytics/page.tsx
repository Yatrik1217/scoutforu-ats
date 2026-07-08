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

  const kpis = [
    { label: "Offer Accept Rate", value: `${offerAcceptRate(ws.candidates)}%`, delta: "+5% vs last qtr", tone: "pos", href: "/offers" },
    { label: "Avg Time-to-Hire", value: tth ? `${tth}d` : "—", delta: "-3d faster", tone: "pos", href: "/pipeline" },
    { label: "Pipeline Velocity", value: `${velAvg}d`, delta: "per stage", tone: "neutral", href: "/pipeline" },
    { label: "Total Hires (QTD)", value: stageCount(ws.candidates, "Joined"), delta: "+17%", tone: "pos", href: "/candidates" },
  ] as const;

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-[18px] grid grid-cols-4 gap-4">
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
      </div>
    </div>
  );
}
