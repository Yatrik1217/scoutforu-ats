import Link from "next/link";
import { Briefcase } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { getProfile } from "@/lib/auth";
import { DEPT_COLOR, hexA } from "@/lib/domain";
import { RecBadge } from "@/components/bits";
import { ScheduleButton, JobMenu } from "@/components/view-actions";
import { JobApprovalActions } from "@/components/job-approval";
import { JobPublish } from "@/components/job-publish";

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

  const activeJobs = ws.jobs.filter((j) => j.status !== "closed");
  const closedJobs = ws.jobs.filter((j) => j.status === "closed");

  const renderJob = (j: (typeof ws.jobs)[number]) => {
    const dc = DEPT_COLOR[j.dept] ?? "#64748b";
    const badge =
      j.approval_status === "pending"
        ? { l: "Pending Approval", c: "#b45309", b: "#fffbeb" }
        : j.approval_status === "rejected"
          ? { l: "Rejected", c: "#6b7280", b: "#f3f4f6" }
          : j.status === "closed"
            ? { l: "Closed", c: "#6b7280", b: "#f3f4f6" }
            : j.status === "hot"
              ? { l: "Hot", c: "#ef4444", b: "#fef2f2" }
              : { l: "Open", c: "#16a34a", b: "#e9f9ef" };
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
                      style={{ color: badge.c, background: badge.b }}
                    >
                      {badge.l}
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
                <Stat value={j.openings} label="Openings" href={`/pipeline?job=${j.id}`} />
                <Stat value={j.applicants_count} label="Applicants" href={`/candidates?job=${j.id}`} />
                <Stat value={inPipe(j.id)} label="In Pipeline" accent href={`/candidates?job=${j.id}`} />
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

              {j.approval_status === "approved" &&
                (j.status === "open" || j.status === "hot") && (
                  <JobPublish
                    jobId={j.id}
                    published={j.published}
                    publishedAt={j.published_at}
                  />
                )}

              <div className="mt-3.5 flex gap-2">
                <Link
                  href={`/pipeline?job=${j.id}`}
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
  };

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          Jobs
        </h1>
        <span className="text-[13px] font-semibold text-[#8a94a6]">
          {activeJobs.length} active{closedJobs.length ? ` · ${closedJobs.length} closed` : ""}
        </span>
      </div>

      {activeJobs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{activeJobs.map(renderJob)}</div>
      ) : (
        <div className="rounded-2xl border border-[#e9edf3] bg-white py-14 text-center text-[13px] font-semibold text-[#a3acbd]">
          No active jobs right now.
        </div>
      )}

      {closedJobs.length > 0 && (
        <>
          <div className="mb-3 mt-9 text-[12px] font-extrabold uppercase tracking-wide text-[#8a94a6]">
            Closed jobs ({closedJobs.length})
          </div>
          <div className="grid grid-cols-1 gap-4 opacity-70 md:grid-cols-2">
            {closedJobs.map(renderJob)}
          </div>
        </>
      )}
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
