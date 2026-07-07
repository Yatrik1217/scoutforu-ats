"use client";

/* This component syncs to an external system (Supabase) on open, so it
   intentionally sets state inside an effect. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ArrowRight, Mail, Calendar, Pencil, Trash2, FileText } from "lucide-react";
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
  RECOMMENDATIONS,
  type StageKey,
} from "@/lib/domain";
import {
  advanceCandidate,
  rejectCandidate,
  deleteCandidate,
  addCandidateNote,
  deleteCandidateNote,
  addInterviewFeedback,
  deleteInterviewFeedback,
} from "@/lib/actions/mutations";
import type {
  CandidateRow,
  StageEventRow,
  FeedbackRecommendation,
} from "@/lib/database.types";

type Note = { id: string; body: string; created_at: string; author: string };

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
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadNotes = async (id: string) => {
    const sb = createClient();
    const [{ data: rows }, { data: profs }] = await Promise.all([
      sb
        .from("candidate_notes")
        .select("id,body,created_at,author_id")
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      sb.from("profiles").select("id,name"),
    ]);
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.name]));
    setNotes(
      (rows ?? []).map((n) => ({
        id: n.id,
        body: n.body,
        created_at: n.created_at,
        author: n.author_id ? (nameById.get(n.author_id) ?? "—") : "—",
      })),
    );
  };

  const submitNote = () => {
    if (!candidateId || !noteText.trim()) return;
    setSavingNote(true);
    addCandidateNote(candidateId, noteText).then((res) => {
      setSavingNote(false);
      if (res.ok) {
        setNoteText("");
        loadNotes(candidateId);
      } else toast.error(res.error ?? "Could not add note");
    });
  };

  const [feedback, setFeedback] = useState<
    { id: string; rating: number; recommendation: FeedbackRecommendation; notes: string; created_at: string; author: string }[]
  >([]);
  const [fbRec, setFbRec] = useState<FeedbackRecommendation>("yes");
  const [fbRating, setFbRating] = useState(4);
  const [fbNotes, setFbNotes] = useState("");
  const [savingFb, setSavingFb] = useState(false);
  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejReason, setRejReason] = useState("");
  const [custFields, setCustFields] = useState<{ field_key: string; label: string }[]>([]);

  useEffect(() => {
    const sb = createClient();
    sb.from("disqualify_reasons")
      .select("id,label")
      .eq("active", true)
      .order("sort")
      .then(({ data }) => setReasons((data ?? []) as { id: string; label: string }[]));
    sb.from("custom_fields")
      .select("field_key,label")
      .eq("module", "candidate")
      .eq("active", true)
      .order("sort")
      .then(({ data }) => setCustFields((data ?? []) as { field_key: string; label: string }[]));
  }, []);

  const loadFeedback = async (id: string) => {
    const sb = createClient();
    const [{ data: rows }, { data: profs }] = await Promise.all([
      sb
        .from("interview_feedback")
        .select("id,rating,recommendation,notes,created_at,interviewer_id")
        .eq("candidate_id", id)
        .order("created_at", { ascending: false }),
      sb.from("profiles").select("id,name"),
    ]);
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.name]));
    setFeedback(
      (rows ?? []).map((r) => ({
        id: r.id,
        rating: r.rating,
        recommendation: r.recommendation,
        notes: r.notes,
        created_at: r.created_at,
        author: r.interviewer_id ? (nameById.get(r.interviewer_id) ?? "—") : "—",
      })),
    );
  };

  const submitFeedback = () => {
    if (!candidateId) return;
    setSavingFb(true);
    addInterviewFeedback(candidateId, fbRating, fbRec, fbNotes).then((res) => {
      setSavingFb(false);
      if (res.ok) {
        setFbNotes("");
        loadFeedback(candidateId);
      } else toast.error(res.error ?? "Could not submit feedback");
    });
  };

  useEffect(() => {
    if (!candidateId) {
      setDetail(null);
      setNotes([]);
      setNoteText("");
      setFeedback([]);
      setFbNotes("");
      return;
    }
    loadNotes(candidateId);
    loadFeedback(candidateId);
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

  const doReject = () =>
    start(async () => {
      const res = await rejectCandidate(candidateId, rejReason);
      if (res.ok) {
        toast.success(res.message ?? "Rejected");
        setRejectOpen(false);
        setRejReason("");
        router.refresh();
        onClose();
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
                {canWrite && detail.cand.resume_url && (
                  <button
                    onClick={async () => {
                      const sb = createClient();
                      const ext = (detail.cand.resume_url.split(".").pop() || "pdf").toLowerCase();
                      const fname = `${(detail.cand.name || "resume").replace(/[^\w .-]+/g, " ").trim() || "resume"}.${ext}`;
                      const { data } = await sb.storage
                        .from("resumes")
                        .createSignedUrl(detail.cand.resume_url, 120, { download: fname });
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                      else toast.error("Could not open the resume file");
                    }}
                    className="flex flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
                  >
                    <FileText size={15} /> Résumé
                  </button>
                )}
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

              {(() => {
                const custom = (detail.cand.custom ?? {}) as Record<string, unknown>;
                const rows = custFields
                  .map((cf) => [cf.label, custom[cf.field_key]] as const)
                  .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "");
                if (!rows.length) return null;
                return (
                  <>
                    <div className="mb-2.5 text-[13px] font-extrabold">Additional Details</div>
                    <div className="mb-6 grid grid-cols-2 gap-[11px]">
                      {rows.map(([label, value]) => (
                        <div key={label} className="rounded-[11px] bg-[#f7f9fc] p-[12px_13px]">
                          <div className="text-[10.5px] font-bold tracking-[.3px] text-[#9aa4b6]">{label}</div>
                          <div className="mt-[3px] text-[13.5px] font-bold text-[#16203a]">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

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

              {canWrite && (
                <>
                  <div className="mb-2.5 mt-7 text-[13px] font-extrabold">Notes</div>
                  <div className="mb-3 flex gap-2">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNote();
                      }}
                      placeholder="Add a note…"
                      className="flex-1 rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13px] outline-none focus:border-[#2a6fdb]"
                    />
                    <button
                      onClick={submitNote}
                      disabled={savingNote || !noteText.trim()}
                      className="rounded-[10px] bg-[#2a6fdb] px-4 text-[12.5px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {notes.length === 0 && (
                    <div className="text-[12px] font-medium text-[#a3acbd]">
                      No notes yet.
                    </div>
                  )}
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      className="group mb-2 rounded-[10px] bg-[#f7f9fc] p-[10px_12px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] font-bold text-[#42506b]">
                          {n.author}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[10.5px] font-medium text-[#a3acbd]">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                          <button
                            onClick={() =>
                              deleteCandidateNote(n.id).then(() => loadNotes(candidateId))
                            }
                            className="text-[#c3cad6] opacity-0 transition group-hover:opacity-100 hover:text-[#dc2626]"
                            title="Delete note"
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-[12.5px] text-[#16203a]">
                        {n.body}
                      </div>
                    </div>
                  ))}

                  <div className="mb-2.5 mt-7 text-[13px] font-extrabold">
                    Interview Feedback
                  </div>
                  <div className="mb-3 rounded-[11px] border border-[#eef1f6] p-3">
                    <div className="mb-2 flex gap-2">
                      <select
                        value={fbRec}
                        onChange={(e) => setFbRec(e.target.value as FeedbackRecommendation)}
                        className="flex-1 cursor-pointer rounded-[9px] border border-[#e3e8f0] px-2.5 py-2 text-[12.5px] font-semibold"
                      >
                        {RECOMMENDATIONS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <select
                        value={fbRating}
                        onChange={(e) => setFbRating(Number(e.target.value))}
                        className="cursor-pointer rounded-[9px] border border-[#e3e8f0] px-2.5 py-2 text-[12.5px] font-semibold"
                      >
                        {[5, 4, 3, 2, 1].map((n) => (
                          <option key={n} value={n}>{"★".repeat(n)} {n}/5</option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      value={fbNotes}
                      onChange={(e) => setFbNotes(e.target.value)}
                      rows={2}
                      placeholder="Interview notes / justification…"
                      className="w-full resize-y rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[12.5px] outline-none focus:border-[#2a6fdb]"
                    />
                    <button
                      onClick={submitFeedback}
                      disabled={savingFb}
                      className="mt-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-50"
                    >
                      Submit feedback
                    </button>
                  </div>
                  {feedback.map((fb) => {
                    const rec = RECOMMENDATIONS.find((r) => r.value === fb.recommendation);
                    return (
                      <div key={fb.id} className="group mb-2 rounded-[10px] bg-[#f7f9fc] p-[10px_12px]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11.5px] font-bold text-[#42506b]">{fb.author}</span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ color: rec?.color, background: hexA(rec?.color ?? "#64748b", 0.12) }}
                            >
                              {rec?.label}
                            </span>
                            <span className="tf-num text-[11px] font-extrabold text-[#b27400]">★ {fb.rating}/5</span>
                          </div>
                          <button
                            onClick={() => deleteInterviewFeedback(fb.id).then(() => loadFeedback(candidateId))}
                            className="text-[#c3cad6] opacity-0 transition group-hover:opacity-100 hover:text-[#dc2626]"
                            title="Delete feedback"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                        {fb.notes && (
                          <div className="mt-1 whitespace-pre-wrap text-[12.5px] text-[#16203a]">{fb.notes}</div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
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
                  onClick={() => setRejectOpen(true)}
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

      {rejectOpen && detail && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setRejectOpen(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-[14px] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-extrabold text-[#16203a]">Reject {detail.cand.name}?</div>
            <p className="mt-1 text-[12.5px] text-[#8a94a6]">Pick a reason (optional) — it&apos;s logged on the candidate.</p>
            <select
              value={rejReason}
              onChange={(e) => setRejReason(e.target.value)}
              className="mt-3 w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#dc2626]"
            >
              <option value="">— No reason —</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.label}>
                  {r.label}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRejectOpen(false)}
                className="rounded-[9px] border border-[#e6eaf1] bg-white px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
              >
                Cancel
              </button>
              <button
                onClick={doReject}
                disabled={pending}
                className="rounded-[9px] bg-[#dc2626] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#c11f1f] disabled:opacity-60"
              >
                {pending ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
