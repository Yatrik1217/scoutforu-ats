"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, AlertTriangle, Copy, CreditCard } from "lucide-react";
import { dumpResumeToTalentBank } from "@/lib/actions/talent-bank";

type Line = { name: string; status: "added" | "duplicate" | "error"; msg: string };

export function TalentBankUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<Line[]>([]);
  const [tally, setTally] = useState({ added: 0, dup: 0, err: 0 });
  const [drag, setDrag] = useState(false);
  // A blocking, account-level problem (no API credits / bad key). When set we
  // stop the batch instead of failing every remaining file the same way.
  const [blocked, setBlocked] = useState<{ message: string; billing: boolean } | null>(null);

  const run = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setLog([]);
    setBlocked(null);
    setTally({ added: 0, dup: 0, err: 0 });
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fd = new FormData();
      fd.append("file", file);
      try {
        const r = await dumpResumeToTalentBank(fd);
        // Account-level failure — no point trying the remaining files.
        if (r.status === "error" && (r.code === "billing" || r.code === "auth" || r.code === "config")) {
          setBlocked({ message: r.message, billing: r.code === "billing" });
          const left = files.length - i;
          setLog((l) => [
            { name: file.name, status: "error", msg: `Stopped — ${left} not attempted` },
            ...l,
          ]);
          setProgress({ done: i, total: files.length });
          break;
        }
        setLog((l) => [
          { name: r.name || file.name, status: r.status, msg: r.category ? `→ ${r.category}` : r.message },
          ...l,
        ]);
        setTally((t) => ({
          added: t.added + (r.status === "added" ? 1 : 0),
          dup: t.dup + (r.status === "duplicate" ? 1 : 0),
          err: t.err + (r.status === "error" ? 1 : 0),
        }));
      } catch (e) {
        setLog((l) => [{ name: file.name, status: "error", msg: (e as Error).message }, ...l]);
        setTally((t) => ({ ...t, err: t.err + 1 }));
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setBusy(false);
    router.refresh();
  };

  const pickFiles = (fl: FileList | null) => {
    if (!fl) return;
    run(Array.from(fl).filter((f) => /\.(pdf|docx?|txt)$/i.test(f.name)));
  };

  return (
    <div>
      {blocked && (
        <div className="mb-3 flex items-start gap-3 rounded-xl border border-[#f3c4c4] bg-[#fef4f4] p-3.5">
          <CreditCard size={18} className="mt-0.5 shrink-0 text-[#dc2626]" />
          <div className="text-[12.5px] leading-relaxed text-[#8a2020]">
            <div className="font-extrabold text-[#b91c1c]">
              {blocked.billing ? "Resume parsing is paused — Anthropic API credits are empty" : "Resume parsing is unavailable"}
            </div>
            <div className="mt-0.5 font-medium">{blocked.message}</div>
            {blocked.billing && (
              <div className="mt-1.5 font-semibold text-[#7a2222]">
                Open the Anthropic Console → <b>Plans &amp; Billing</b> → <b>Purchase credits</b> (about
                ₹0.55 per resume, so ~$30 clears a 2,000-resume backlog). Then drop the files again —
                already-filed and duplicate resumes are skipped for free.
              </div>
            )}
          </div>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pickFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
          drag ? "border-[#2a6fdb] bg-[#eef4fe]" : "border-[#d7dfea] bg-[#f8fafc] hover:border-[#2a6fdb]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <UploadCloud size={30} className="text-[#2a6fdb]" />
        <div className="mt-2 text-[14px] font-extrabold text-[#16203a]">
          {busy ? `Filing… ${progress.done}/${progress.total}` : "Drop resumes here, or click to select"}
        </div>
        <div className="mt-1 text-[12px] text-[#8a94a6]">
          PDF / DOCX · dump as many as you like — each is auto-sorted by technology, never added to the pipeline
        </div>
        {busy && (
          <div className="mt-3 h-[6px] w-[220px] overflow-hidden rounded-full bg-[#e3e8f0]">
            <div
              className="h-full rounded-full bg-[#2a6fdb] transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {(log.length > 0 || tally.added + tally.dup + tally.err > 0) && (
        <div className="mt-3 rounded-xl border border-[#e9edf3] bg-white p-3">
          <div className="mb-2 flex flex-wrap gap-3 text-[12px] font-bold">
            <span className="text-[#16a34a]">{tally.added} filed</span>
            <span className="text-[#c9781f]">{tally.dup} duplicate</span>
            <span className="text-[#dc2626]">{tally.err} error</span>
          </div>
          <div className="max-h-[180px] space-y-1 overflow-auto">
            {log.map((l, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                {l.status === "added" ? (
                  <CheckCircle2 size={13} className="shrink-0 text-[#16a34a]" />
                ) : l.status === "duplicate" ? (
                  <Copy size={13} className="shrink-0 text-[#c9781f]" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0 text-[#dc2626]" />
                )}
                <span className="font-semibold text-[#16203a]">{l.name}</span>
                <span className="truncate text-[#8a94a6]">{l.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
