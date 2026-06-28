import Link from "next/link";
import { Briefcase, MoreVertical } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { DEPT_COLOR, hexA } from "@/lib/domain";
import { RecBadge } from "@/components/bits";
import { ScheduleButton } from "@/components/view-actions";

function ago(iso: string) {
  const d = Math.floor((Date.now() - +new Date(iso)) / 86_400_000);
  return d <= 0 ? "just now" : `${d}d ago`;
}

export default async function JobsPage() {
  const { ws } = await loadWorkspace();
  const inPipe = (jobId: string) =>
    ws.candidates.filter(
      (c) => c.job_id === jobId && c.stageKey !== "Not Joined",
    ).length;
  const clientName = new Map(ws.clients.map((c) => [c.id, c.name]));

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="grid grid-cols-2 gap-4">
        {ws.jobs.map((j) => {
          const dc = DEPT_COLOR[j.dept] ?? "#64748b";
          return (
            <div
              key={j.id}
              className="rounded-2xl border border-[#e9edf3] bg-white p-5"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: hexA(dc, 0.13), color: dc }}
                >
                  <Briefcase size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-extrabold">{j.title}</span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold"
                      style={{
                        color: j.status === "hot" ? "#ef4444" : "#16a34a",
                        background: j.status === "hot" ? "#fef2f2" : "#e9f9ef",
                      }}
                    >
                      {j.status === "hot" ? "Hot" : "Open"}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] font-medium text-[#8a94a6]">
                    {j.dept} · {j.location} ·{" "}
                    {j.type === "full_time"
                      ? "Full-time"
                      : j.type === "contract"
                        ? "Contract"
                        : "Intern"}
                  </div>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="mt-[18px] flex gap-[22px] border-t border-[#f0f3f8] pt-4">
                <Stat value={j.openings} label="Openings" />
                <Stat value={j.applicants_count} label="Applicants" />
                <Stat value={inPipe(j.id)} label="In Pipeline" accent />
                <div className="flex-1" />
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {j.recruiter_id && (
                      <RecBadge
                        name={ws.profileById.get(j.recruiter_id)?.name ?? "—"}
                        color={ws.profileById.get(j.recruiter_id)?.color ?? "#64748b"}
                      />
                    )}
                    <span className="text-[12px] font-semibold text-[#42506b]">
                      {j.recruiter_id
                        ? ws.profileById.get(j.recruiter_id)?.name
                        : "Unassigned"}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#a3acbd]">
                    {j.client_id ? clientName.get(j.client_id) : "—"} ·{" "}
                    {ago(j.posted_at)}
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex gap-2">
                <Link
                  href="/pipeline"
                  className="flex-1 rounded-[9px] bg-[#eef4fe] py-2.5 text-center text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
                >
                  View Pipeline
                </Link>
                <ScheduleButton className="flex-1 rounded-[9px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]">
                  Schedule
                </ScheduleButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        className="tf-num text-[19px] font-extrabold"
        style={accent ? { color: "#2a6fdb" } : undefined}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold text-[#9aa4b6]">{label}</div>
    </div>
  );
}
