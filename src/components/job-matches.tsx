"use client";

import { useState, useTransition } from "react";
import { Sparkles, X, Star, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/bits";
import { useShell } from "@/components/shell-provider";
import {
  suggestMatchesForJob,
  assignCandidateToJob,
  assignBankResumeToJob,
  type CandidateMatch,
} from "@/lib/actions/match";

export function JobMatches({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[9px] border border-[#d9e6fb] bg-[#eef4fe] px-3 py-2 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
        title="Screen the talent pool & bank for resumes matching this opening"
      >
        <Sparkles size={14} /> Find matches
      </button>
      {open && <MatchModal jobId={jobId} jobTitle={jobTitle} onClose={() => setOpen(false)} />}
    </>
  );
}

function MatchModal({
  jobId,
  jobTitle,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { openDrawer } = useShell();
  const [loading, startLoad] = useTransition();
  const [assigning, startAssign] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [scanned, setScanned] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  // Load on first render.
  if (!loaded && !loading) {
    startLoad(async () => {
      const res = await suggestMatchesForJob(jobId);
      setLoaded(true);
      if (res.ok) { setMatches(res.matches ?? []); setScanned(res.scanned ?? 0); }
      else setErr(res.error ?? "Could not find matches.");
    });
  }

  const assign = (m: CandidateMatch) => {
    const where = m.source === "bank" ? "from the Talent Bank" : "off their current opening";
    if (!confirm(`Add ${m.name} to "${jobTitle}" (${where})? They'll start at the first stage.`)) return;
    startAssign(async () => {
      const res =
        m.source === "bank"
          ? await assignBankResumeToJob(m.id, jobId)
          : await assignCandidateToJob(m.id, jobId);
      if (res.ok) {
        toast.success(res.message ?? "Added");
        setMatches((list) => list.filter((x) => !(x.id === m.id && x.source === m.source)));
        router.refresh();
      } else toast.error(res.error ?? "Could not add");
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0e1320]/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-[620px] max-w-full flex-col rounded-[18px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-[#eef1f6] p-[18px_22px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eef4fe] text-[#2a6fdb]">
            <Sparkles size={18} />
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-[#16203a]">Matching resumes</div>
            <div className="text-[12.5px] font-semibold text-[#8a94a6]">
              for <span className="text-[#42506b]">{jobTitle}</span>
              {loaded && !err ? ` · ${matches.length} match${matches.length === 1 ? "" : "es"} from ${scanned.toLocaleString("en-IN")} resumes (pool + bank), scanned instantly` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-[#8a94a6] hover:text-[#42506b]"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-[14px_16px]">
          {loading && (
            <div className="py-16 text-center text-[13px] font-semibold text-[#8a94a6]">Screening resumes…</div>
          )}
          {err && (
            <div className="m-2 rounded-[12px] border border-[#fde68a] bg-[#fffbeb] p-4 text-[13px] font-semibold text-[#92400e]">
              {err}
            </div>
          )}
          {loaded && !err && matches.length === 0 && (
            <div className="py-16 text-center text-[13px] font-semibold text-[#a3acbd]">
              No matching resumes found in the pool or bank.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {matches.map((m) => (
              <div key={m.id} className="rounded-[13px] border border-[#eef1f6] bg-[#fafbfe] p-[12px_14px]">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} size={38} />
                  <div className="min-w-0 flex-1">
                    {m.source === "pipeline" ? (
                      <button
                        onClick={() => { onClose(); openDrawer(m.id); }}
                        className="truncate text-left text-[14px] font-bold text-[#16203a] hover:text-[#2a6fdb]"
                      >
                        {m.name}
                      </button>
                    ) : (
                      <span className="truncate text-[14px] font-bold text-[#16203a]">{m.name}</span>
                    )}
                    <div className="truncate text-[11.5px] font-semibold text-[#8a94a6]">
                      {m.designation || "—"} · {m.expYears}y ·{" "}
                      {m.source === "bank" ? (
                        <span className="font-bold text-[#2a6fdb]">Talent Bank · {m.stageName}</span>
                      ) : m.onHold ? (
                        <span className="text-[#b45309]">on hold</span>
                      ) : (
                        <>currently: {m.currentJobTitle} <span className="text-[#aab2c0]">({m.stageName})</span></>
                      )}
                    </div>
                  </div>
                  <span className="tf-num flex shrink-0 items-center gap-1 rounded-full bg-[#eef4fe] px-2.5 py-1 text-[11.5px] font-extrabold text-[#2a6fdb]">
                    {m.score} match{m.score === 1 ? "" : "es"}
                  </span>
                  {m.rating > 0 && (
                    <span className="tf-num flex shrink-0 items-center gap-[3px] text-[11px] font-extrabold text-[#b27400]">
                      <Star size={12} /> {m.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {m.matched.slice(0, 10).map((t) => (
                    <span key={t} className="rounded-full bg-[#eafaf0] px-2 py-0.5 text-[10.5px] font-bold text-[#16a34a]">
                      {t}
                    </span>
                  ))}
                  <div className="flex-1" />
                  <button
                    disabled={assigning}
                    onClick={() => assign(m)}
                    className="flex items-center gap-1 rounded-[8px] bg-[#2a6fdb] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-60"
                    title="Move this candidate onto the opening"
                  >
                    Assign here <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#eef1f6] p-[10px_22px] text-[11px] font-semibold text-[#aab2c0]">
          Ranked by how many of the opening’s skills/keywords appear in each resume. Open a candidate to run the AI “JD Match” score for a precise fit.
        </div>
      </div>
    </div>
  );
}
