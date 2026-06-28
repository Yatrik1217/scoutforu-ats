"use client";

/* This component syncs to an external system (Supabase) on open, so it
   intentionally sets state inside an effect. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ArrowRight, Mail, Calendar, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PIPELINE_STAGES,
  stageColor,
  stageFromSlug,
  stageIndex,
  nextStage,
  hexA,
  fmtSalary,
  daysInStage,
  type StageKey,
} from "@/lib/domain";
import {
  advanceCandidate,
  rejectCandidate,
  deleteCandidate,
} from "@/lib/actions/mutations";
import type { CandidateRow, StageEventRow } from "@/lib/database.types";

type Detail = {
  cand: CandidateRow;
  stage: StageKey;
  jobTitle: string;
  recruiterName: string;
  events: StageEventRow[];
};

export function CandidateDrawer({
  candidateId,
  canWrite,
  onClose,
  onSchedule,
  onEdit,
}: {
  candidateId: string | null;
  canWrite: boolean;
  onClose: () => void;
  onSchedule: (id: string) => void;
  onEdit: (candidate: CandidateRow) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!candidateId) {
      setDetail(null);
      return;
    }
    let active = true;
    (async () => {
      const sb = createClient();
      const { data: cand } = await sb
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .single();
      if (!cand || !active) return;
      const [job, rec, events] = await Promise.all([
        cand.job_id
          ? sb.from("jobs").select("title").eq("id", cand.job_id).single()
          : Promise.resolve({ data: null }),
        cand.recruiter_id
          ? sb
              .from("profiles")
              .select("name")
              .eq("id", cand.recruiter_id)
              .single()
          : Promise.resolve({ data: null }),
        sb
          .from("stage_events")
          .select("*")
          .eq("candidate_id", candidateId)
          .order("created_at"),
      ]);
      if (!active) return;
      setDetail({
        cand,
        stage: stageFromSlug(cand.stage),
        jobTitle: job.data?.title ?? "—",
        recruiterName: rec.data?.name ?? "Unassigned",
        events: events.data ?? [],
      });
    })();
    return () => {
      active = false;
    };
  }, [candidateId]);

  if (!candidateId) return null;

  const run = (
    fn: (id: string) => Promise<{ ok: boolean; error?: string; message?: string }>,
    close = false,
  ) =>
    start(async () => {
      const res = await fn(candidateId);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
        if (close) onClose();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });

  const sc = detail ? stageColor(detail.stage) : "#64748b";
  const idx = detail ? stageIndex(detail.stage) : 0;
  const next = detail ? nextStage(detail.stage) : null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-[rgba(16,24,40,.45)] animate-sc-fadein"
      />
      <div className="fixed bottom-0 right-0 top-0 z-[81] flex w-[480px] max-w-full flex-col bg-white shadow-[-12px_0_40px_rgba(16,24,40,.2)] animate-sc-flyin">
        {detail && (
          <>
            <div
              className="relative shrink-0 p-[24px_22px]"
              style={{
                background: `linear-gradient(135deg,${sc},${hexA(sc, 0.78)})`,
              }}
            >
              <button
                onClick={onClose}
                className="absolute right-[18px] top-[18px] flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-white/20 text-white hover:bg-white/30"
              >
                <X size={17} strokeWidth={2.4} />
              </button>
              <div className="flex items-center gap-[15px]">
                <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[15px] border-2 border-white/35 bg-white/20 text-[21px] font-extrabold text-white">
                  {detail.cand.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <div className="text-[21px] font-extrabold tracking-tight text-white">
                    {detail.cand.name}
                  </div>
                  <div className="text-[13px] font-medium text-white/85">
                    {detail.jobTitle}
                  </div>
                  <div className="mt-[7px] flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2.5 py-[3px] text-[11px] font-bold text-white">
                      {detail.stage}
                    </span>
                    <span className="tf-num text-[12px] font-extrabold text-white">
                      ★ {detail.cand.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-[22px]">
              <div className="mb-5 flex gap-2">
                <a
                  href={`mailto:${detail.cand.email ?? ""}`}
                  className="flex flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
                >
                  <Mail size={15} /> Email
                </a>
                {canWrite && (
                  <button
                    onClick={() => onSchedule(detail.cand.id)}
                    className="flex flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
                  >
                    <Calendar size={15} /> Schedule
                  </button>
                )}
                {canWrite && (
                  <button
                    onClick={() => onEdit(detail.cand)}
                    className="flex flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
                  >
                    <Pencil size={15} /> Edit
                  </button>
                )}
              </div>

              <div className="mb-[22px] grid grid-cols-2 gap-[11px]">
                {(
                  [
                    ["Experience", `${detail.cand.exp_years} years`],
                    ["Location", detail.cand.location ?? "—"],
                    ["Source", detail.cand.source ?? "—"],
                    ["Current CTC", fmtSalary(detail.cand.current_ctc_lpa)],
                    ["Expected CTC", fmtSalary(detail.cand.expected_ctc_lpa)],
                    ["Notice Period", `${detail.cand.notice_period_days} days`],
                    ["Recruiter", detail.recruiterName],
                    ["Days in stage", `${daysInStage(detail.cand.entered_stage_at)} days`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-[11px] bg-[#f7f9fc] p-[12px_13px]">
                    <div className="text-[10.5px] font-bold tracking-[.3px] text-[#9aa4b6]">
                      {label}
                    </div>
                    <div className="mt-[3px] text-[13.5px] font-bold text-[#16203a]">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {detail.cand.tags.length > 0 && (
                <>
                  <div className="mb-2.5 text-[13px] font-extrabold">Skills</div>
                  <div className="mb-6 flex flex-wrap gap-1.5">
                    {detail.cand.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-[#eef4fe] px-3 py-[5px] text-[12px] font-semibold text-[#2a6fdb]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}

              <div className="mb-3.5 text-[13px] font-extrabold">Stage Progress</div>
              <div className="relative pl-1.5">
                {PIPELINE_STAGES.map((s, i) => {
                  const done = i < idx;
                  const current = i === idx;
                  const last = i === PIPELINE_STAGES.length - 1;
                  return (
                    <div key={s.key} className="relative flex gap-3.5 pb-[18px]">
                      {!last && (
                        <div
                          className="absolute left-[11px] top-6 w-0.5"
                          style={{
                            height: "calc(100% - 6px)",
                            background: done ? "#16a34a" : "#e9edf3",
                          }}
                        />
                      )}
                      <div
                        className="z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: done ? "#16a34a" : current ? sc : "#e3e8f0",
                          border: current ? `3px solid ${hexA(sc, 0.3)}` : "none",
                          boxShadow: current ? `0 0 0 3px ${hexA(sc, 0.15)}` : "none",
                        }}
                      >
                        {done && (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#fff"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-[13px]"
                          style={{
                            fontWeight: current ? 800 : 700,
                            color: current ? sc : done ? "#16203a" : "#9aa4b6",
                          }}
                        >
                          {s.key}
                        </div>
                        <div className="text-[11px] font-medium text-[#a3acbd]">
                          {done ? "Completed" : current ? "Current stage" : "Upcoming"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canWrite && (
              <div className="flex shrink-0 gap-2.5 border-t border-[#eef1f6] p-[16px_22px]">
                <button
                  disabled={pending}
                  title="Delete candidate"
                  onClick={() => {
                    if (confirm(`Delete ${detail.cand.name}? This cannot be undone.`))
                      run(deleteCandidate, true);
                  }}
                  className="flex items-center justify-center rounded-[11px] border border-[#eadfe0] bg-[#fafafa] px-3 py-3 text-[#9aa4b6] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  disabled={pending}
                  onClick={() => run(rejectCandidate, true)}
                  className="rounded-[11px] border border-[#f3c4c4] bg-[#fef2f2] px-4 py-3 text-[13px] font-bold text-[#dc2626] hover:bg-[#fee2e2] disabled:opacity-60"
                >
                  Reject
                </button>
                <button
                  disabled={pending || !next}
                  onClick={() => run(advanceCandidate)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60"
                >
                  {next ? `Move to ${next}` : "Final Stage"}
                  {next && <ArrowRight size={16} strokeWidth={2.4} />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
