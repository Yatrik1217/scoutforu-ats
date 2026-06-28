"use client";

/* Resets form + loads candidate options from Supabase when the modal opens —
   intentional state-sync inside an effect. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { scheduleInterview } from "@/lib/actions/mutations";
import type { InterviewTypeEnum, ProfileRow } from "@/lib/database.types";

const TYPES: { label: string; value: InterviewTypeEnum }[] = [
  { label: "Video", value: "video" },
  { label: "Phone", value: "phone" },
  { label: "Onsite", value: "onsite" },
  { label: "Practical", value: "practical" },
];
const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

export function ScheduleModal({
  open,
  candidateId,
  team,
  onClose,
}: {
  open: boolean;
  candidateId?: string;
  team: ProfileRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const [opts, setOpts] = useState<{ id: string; label: string }[]>([]);
  const [f, setF] = useState<{
    candidateId: string;
    date: string;
    time: string;
    type: InterviewTypeEnum;
    interviewerId: string | null;
  }>({
    candidateId: candidateId ?? "",
    date: "",
    time: "",
    type: "video",
    interviewerId: team[0]?.id ?? null,
  });

  useEffect(() => {
    if (!open) return;
    setF((s) => ({ ...s, candidateId: candidateId ?? "" }));
    setErr(false);
    (async () => {
      const sb = createClient();
      const [{ data: cands }, { data: jobs }] = await Promise.all([
        sb
          .from("candidates")
          .select("id,name,stage,job_id")
          .not("stage", "in", "(joined,not_joined)"),
        sb.from("jobs").select("id,title"),
      ]);
      const jobTitle = new Map((jobs ?? []).map((j) => [j.id, j.title]));
      setOpts(
        (cands ?? []).map((c) => ({
          id: c.id,
          label: `${c.name} — ${c.job_id ? jobTitle.get(c.job_id) ?? "—" : "—"}`,
        })),
      );
    })();
  }, [open, candidateId]);

  if (!open) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.candidateId || !f.date || !f.time) {
      setErr(true);
      return;
    }
    start(async () => {
      const res = await scheduleInterview(f);
      if (res.ok) {
        toast.success(res.message ?? "Interview scheduled");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
      >
        <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[22px_24px_16px]">
          <div>
            <div className="text-[18px] font-extrabold">Schedule Interview</div>
            <div className="text-[12.5px] font-medium text-[#8a94a6]">
              Set up the next round
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-[22px_24px]">
          <label className={labelCls}>
            Candidate <span className="text-[#ef4444]">*</span>
          </label>
          <select
            value={f.candidateId}
            onChange={(e) => set("candidateId", e.target.value)}
            className={`${fieldCls} cursor-pointer`}
            style={err && !f.candidateId ? { borderColor: "#ef4444" } : undefined}
          >
            <option value="">Select a candidate…</option>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {err && (
            <div className="mt-1.5 text-[11.5px] font-semibold text-[#ef4444]">
              Please pick a candidate, date and time.
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>
                Date <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="date"
                value={f.date}
                onChange={(e) => set("date", e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Time <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="time"
                value={f.time}
                onChange={(e) => set("time", e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={f.type}
                onChange={(e) => set("type", e.target.value as InterviewTypeEnum)}
                className={`${fieldCls} cursor-pointer`}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Interviewer</label>
              <select
                value={f.interviewerId ?? ""}
                onChange={(e) => set("interviewerId", e.target.value || null)}
                className={`${fieldCls} cursor-pointer`}
              >
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 border-t border-[#f0f3f8] p-[16px_24px]">
          <button
            onClick={onClose}
            className="flex-1 rounded-[11px] border border-[#e6eaf1] py-3 text-[13.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60"
          >
            Confirm Interview
          </button>
        </div>
      </div>
    </div>
  );
}
