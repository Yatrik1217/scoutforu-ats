import Link from "next/link";
import { loadWorkspace } from "@/lib/data";
import { Avatar } from "@/components/bits";

export default async function TeamPage() {
  const { ws } = await loadWorkspace();
  const recruiters = ws.team.filter((p) => p.role === "recruiter");

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="grid grid-cols-2 gap-4">
        {recruiters.map((t) => {
          const active = ws.candidates.filter(
            (c) =>
              c.recruiter_id === t.id &&
              c.stageKey !== "Joined" &&
              c.stageKey !== "Not Joined",
          ).length;
          const interviews = ws.interviews.filter(
            (i) => i.interviewer_id === t.id,
          ).length;
          const hires = ws.candidates.filter(
            (c) => c.recruiter_id === t.id && c.stageKey === "Joined",
          ).length;
          const pct = Math.min(100, Math.round((active / 8) * 100));
          const barColor = pct > 80 ? "#ef4444" : pct > 55 ? "#f59e0b" : "#16a34a";
          return (
            <div
              key={t.id}
              className="rounded-2xl border border-[#e9edf3] bg-white p-5"
            >
              <div className="flex items-center gap-3.5">
                <Avatar name={t.name} size={46} />
                <div className="flex-1">
                  <div className="text-[15.5px] font-extrabold">{t.name}</div>
                  <div className="text-[12px] font-semibold text-[#8a94a6]">
                    Recruiter
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={
                    t.active
                      ? { background: "#e9f9ef", color: "#16a34a" }
                      : { background: "#fef2f2", color: "#dc2626" }
                  }
                >
                  {t.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-[18px] flex gap-2.5">
                <Tile value={active} label="Active" color="#2a6fdb" href="/candidates" />
                <Tile value={interviews} label="Interviews" color="#8b5cf6" href="/interviews" />
                <Tile value={hires} label="Hires" color="#16a34a" href="/candidates" />
              </div>
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-[11.5px] font-semibold text-[#8a94a6]">
                  <span>Workload</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded bg-[#f1f4f9]">
                  <div
                    className="h-full rounded"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  color,
  href,
}: {
  value: number;
  label: string;
  color: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="tf-num text-[21px] font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10.5px] font-semibold text-[#8a94a6]">{label}</div>
    </>
  );
  if (href)
    return (
      <Link
        href={href}
        className="flex-1 rounded-[11px] bg-[#f7f9fc] p-3 text-center transition hover:bg-[#eef1f6]"
      >
        {inner}
      </Link>
    );
  return <div className="flex-1 rounded-[11px] bg-[#f7f9fc] p-3 text-center">{inner}</div>;
}
