import Link from "next/link";
import { Briefcase } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { getProfile } from "@/lib/auth";
import { DEPT_COLOR, hexA } from "@/lib/domain";
import { RecBadge } from "@/components/bits";
import { ScheduleButton, JobMenu } from "@/components/view-actions";
import { JobApprovalActions } from "@/components/job-approval";

function ago(iso: string) {
  const d = Math.floor((Date.now() - +new Date(iso)) / 86_400_000);
  return d <= 0 ? "just now" : `${d}d ago`;
}

export default async function JobsPage() {
  const { ws, scope } = await loadWorkspace();
  const me = await getProfile();
  const canApprove =
    scope.role === "master_admin" || (scope.role === "recruiter" && !!me?.is_approver);
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
                        color:
                          j.approval_status === "pending"
                            ? "#b45309"
                            : j.approval_status === "rejected"
                              ? "#6b7280"
                              : j.status === "hot"
                                ? "#ef4444"
                                : "#16a34a",
                        background:
                          j.approval_status === "pending"
                            ? "#fffbeb"
                            : j.approval_status === "rejected"
                              ? "#f3f4f6"
                              : j.status === "hot"
                                ? "#fef2f2"
                                : "#e9f9ef",
                      }}
                    >
                      {j.approval_status === "pending"
                        ? "Pending Approval"
                        : j.approval_status === "rejected"
                          ? "Rejected"
                          : j.status === "hot"
                            ? "Hot"
                            : "Open"}
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
                  {(j.min_ctc_lpa > 0 || j.max_ctc_lpa > 0) && (
                    <div className="tf-num mt-1 text-[11.5px] font-bold text-[#16a34a]">
                      Budget: ₹{j.min_ctc_lpa}–{j.max_ctc_lpa} LPA
                    </div>
                  )}
                </div>
                <JobMenu job={j} />
              </div>

              <div className="mt-[18px] flex gap-[22px] border-t border-[#f0f3f8] pt-4">
                <Stat value={j.openings} label="Openings" href="/pipeline" />
                <Stat value={j.applicants_count} label="Applicants" href="/candidates" />
                <Stat value={inPipe(j.id)} label="In Pipeline" accent href="/pipeline" />
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

              {j.approval_status === "pending" && canApprove && (
                <JobApprovalActions jobId={j.id} />
              )}

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
  href,
}: {
  value: number;
  label: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <div
        className="tf-num text-[19px] font-extrabold"
        style={accent ? { color: "#2a6fdb" } : undefined}
      >
        {value}
      </div>
      <div className="text-[11px] font-semibold text-[#9aa4b6]">{label}</div>
    </>
  );
  if (href)
    return (
      <Link href={href} className="-mx-1.5 rounded-[8px] px-1.5 py-0.5 hover:bg-[#f6f8fb]">
        {inner}
      </Link>
    );
  return <div>{inner}</div>;
}
