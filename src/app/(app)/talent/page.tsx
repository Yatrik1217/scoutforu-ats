import { loadWorkspace } from "@/lib/data";
import { Avatar } from "@/components/bits";
import { TalentAdvance } from "@/components/view-actions";

export default async function TalentPage() {
  const { ws } = await loadWorkspace();
  const sourced = ws.candidates.filter((c) => c.stageKey === "Sourced");

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="grid grid-cols-3 gap-4">
        {sourced.map((c) => (
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
            <div className="mt-3 text-[12px] font-medium text-[#5a6573]">
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
            <TalentAdvance id={c.id} />
          </div>
        ))}
        {sourced.length === 0 && (
          <div className="col-span-3 py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
            No sourced candidates right now.
          </div>
        )}
      </div>
    </div>
  );
}
