"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Briefcase, ChevronRight, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/bits";

export type OpeningBreakdown = {
  jobId: string;
  title: string;
  dept: string;
  clientName: string | null;
  status: "open" | "hot" | "closed";
  active: number; // active candidates this recruiter is working on this opening
  stalled: number; // of those, how many are idle past the stall threshold
  stages: { name: string; n: number }[];
};

export type RecruiterCard = {
  id: string;
  name: string;
  isActive: boolean;
  activeCount: number;
  stalledCount: number;
  interviewing: number;
  hires: number;
  pct: number;
  barColor: string;
  openings: OpeningBreakdown[];
  week: { submitted: number; interviews: number; offers: number; hires: number };
  conv: { handled: number; interviewPct: number; offerPct: number; hirePct: number };
};

export function TeamBoard({
  recruiters,
  asOf,
  stallDays,
}: {
  recruiters: RecruiterCard[];
  asOf: string;
  stallDays: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = recruiters.find((r) => r.id === openId) ?? null;

  return (
    <>
      <div className="mb-3 text-[12px] font-semibold text-[#8a94a6]">
        As of {asOf} · click a recruiter to see the openings they’ve submitted candidates to
      </div>
      <div className="grid grid-cols-2 gap-4">
        {recruiters.map((t) => (
          <button
            key={t.id}
            onClick={() => setOpenId(t.id)}
            className="rounded-2xl border border-[#e9edf3] bg-white p-5 text-left transition hover:border-[#c9d6ee] hover:shadow-[0_8px_24px_rgba(20,32,58,.08)]"
          >
            <div className="flex items-center gap-3.5">
              <Avatar name={t.name} size={46} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15.5px] font-extrabold">{t.name}</span>
                  {t.stalledCount > 0 && (
                    <span
                      className="flex items-center gap-1 rounded-full bg-[#fdecec] px-2 py-0.5 text-[10.5px] font-bold text-[#dc2626]"
                      title={`${t.stalledCount} candidate(s) idle over ${stallDays} days`}
                    >
                      <AlertTriangle size={11} strokeWidth={2.5} /> {t.stalledCount} stalled
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-semibold text-[#8a94a6]">
                  Recruiter ·{" "}
                  <span className="text-[#2a6fdb]">
                    {t.openings.length} opening{t.openings.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={
                  t.isActive
                    ? { background: "#e9f9ef", color: "#16a34a" }
                    : { background: "#fef2f2", color: "#dc2626" }
                }
              >
                {t.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="mt-[18px] flex gap-2.5">
              <Tile value={t.activeCount} label="Active" color="#2a6fdb" />
              <Tile value={t.interviewing} label="Interviewing" color="#8b5cf6" />
              <Tile value={t.hires} label="Hires" color="#16a34a" />
            </div>

            {/* This week */}
            <div className="mt-3 rounded-[11px] bg-[#f7f9fc] p-[10px_12px]">
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">
                This week
              </div>
              <div className="flex items-center justify-between">
                <WeekStat n={t.week.submitted} label="Submitted" />
                <WeekStat n={t.week.interviews} label="Interviews" />
                <WeekStat n={t.week.offers} label="Offers" />
                <WeekStat n={t.week.hires} label="Hires" />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-[11.5px] font-semibold text-[#8a94a6]">
                <span>Workload</span>
                <span>{t.pct}%</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded bg-[#f1f4f9]">
                <div
                  className="h-full rounded"
                  style={{ width: `${t.pct}%`, background: t.barColor }}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[12px] font-bold text-[#2a6fdb]">
              View openings <ChevronRight size={14} />
            </div>
          </button>
        ))}
      </div>

      {open && (
        <OpeningsModal
          rec={open}
          asOf={asOf}
          stallDays={stallDays}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function OpeningsModal({
  rec,
  asOf,
  stallDays,
  onClose,
}: {
  rec: RecruiterCard;
  asOf: string;
  stallDays: number;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0e1320]/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[580px] max-w-full flex-col rounded-[18px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start gap-3.5 border-b border-[#eef1f6] p-[20px_22px]">
          <Avatar name={rec.name} size={44} />
          <div className="flex-1">
            <div className="text-[16.5px] font-extrabold">{rec.name}</div>
            <div className="text-[12.5px] font-semibold text-[#8a94a6]">
              {rec.openings.length} opening{rec.openings.length === 1 ? "" : "s"} ·{" "}
              {rec.activeCount} active candidate{rec.activeCount === 1 ? "" : "s"} · as of {asOf}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a94a6] hover:text-[#42506b]"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* this week + conversion */}
        <div className="grid grid-cols-2 gap-3 border-b border-[#eef1f6] p-[16px_22px]">
          <div className="rounded-[12px] bg-[#f7f9fc] p-[12px_14px]">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">
              This week (7 days)
            </div>
            <div className="flex justify-between">
              <WeekStat n={rec.week.submitted} label="Submitted" />
              <WeekStat n={rec.week.interviews} label="Interviews" />
              <WeekStat n={rec.week.offers} label="Offers" />
              <WeekStat n={rec.week.hires} label="Hires" />
            </div>
          </div>
          <div className="rounded-[12px] bg-[#f7f9fc] p-[12px_14px]">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">
              Conversion · {rec.conv.handled} handled
            </div>
            <div className="flex justify-between">
              <ConvStat pct={rec.conv.interviewPct} label="Interview" color="#8b5cf6" />
              <ConvStat pct={rec.conv.offerPct} label="Offer" color="#d9730d" />
              <ConvStat pct={rec.conv.hirePct} label="Hire" color="#16a34a" />
            </div>
          </div>
        </div>

        {/* openings list */}
        <div className="flex-1 overflow-y-auto p-[14px_16px]">
          {rec.openings.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Briefcase size={26} className="text-[#c3ccdb]" />
              <div className="text-[13px] font-semibold text-[#8a94a6]">
                No active candidates on any opening right now.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {rec.openings.map((o) => (
                <Link
                  key={o.jobId}
                  href={`/candidates?recruiter=${rec.id}&job=${o.jobId}`}
                  className="group flex items-center gap-3 rounded-[13px] border border-[#eef1f6] bg-[#fafbfe] p-[13px_15px] transition hover:border-[#c9d6ee] hover:bg-white"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-bold text-[#16203a]">
                        {o.title}
                      </span>
                      {o.status === "hot" && (
                        <span className="shrink-0 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-bold text-[#d9730d]">
                          Hot
                        </span>
                      )}
                      {o.status === "closed" && (
                        <span className="shrink-0 rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[10px] font-bold text-[#8a94a6]">
                          Closed
                        </span>
                      )}
                      {o.stalled > 0 && (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#dc2626]"
                          title={`${o.stalled} idle over ${stallDays} days`}
                        >
                          <AlertTriangle size={10} strokeWidth={2.5} /> {o.stalled}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11.5px] font-semibold text-[#8a94a6]">
                      {[o.clientName, o.dept].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {o.stages.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {o.stages.map((s) => (
                          <span
                            key={s.name}
                            className="rounded-full bg-[#eef4fe] px-2 py-0.5 text-[10.5px] font-bold text-[#3b5b8c]"
                          >
                            {s.name} {s.n}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="tf-num text-[22px] font-extrabold leading-none text-[#2a6fdb]">
                      {o.active}
                    </span>
                    <span className="text-[10px] font-semibold text-[#8a94a6]">
                      {o.active === 1 ? "candidate" : "candidates"}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-[#c3ccdb] group-hover:text-[#2a6fdb]"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="flex-1 rounded-[11px] bg-[#f7f9fc] p-3 text-center">
      <div className="tf-num text-[21px] font-extrabold" style={{ color }}>
        {value}
      </div>
      <div className="text-[10.5px] font-semibold text-[#8a94a6]">{label}</div>
    </div>
  );
}

function WeekStat({ n, label }: { n: number; label: string }) {
  return (
    <div className="text-center">
      <div className="tf-num text-[16px] font-extrabold text-[#16203a]">{n}</div>
      <div className="text-[9.5px] font-semibold text-[#9aa4b6]">{label}</div>
    </div>
  );
}

function ConvStat({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="tf-num text-[16px] font-extrabold" style={{ color }}>
        {pct}%
      </div>
      <div className="text-[9.5px] font-semibold text-[#9aa4b6]">{label}</div>
    </div>
  );
}
