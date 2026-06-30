"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { bulkProcessResume, type BulkResult } from "@/lib/actions/bulk-resume";

type Item = {
  file: File;
  status: "pending" | "processing" | BulkResult["status"];
  message: string;
  name: string;
};

const ACCEPT = ".pdf,.docx,.txt";
const okType = (f: File) =>
  /\.(pdf|docx|txt)$/i.test(f.name) && f.size <= 8 * 1024 * 1024;

export function BulkUploadClient() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...files]
      .filter(okType)
      .map((file) => ({ file, status: "pending" as const, message: "", name: file.name }));
    setItems((prev) => [...prev, ...next]);
  };

  const process = async () => {
    setRunning(true);
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== "pending") continue;
      setItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: "processing" } : it)),
      );
      const fd = new FormData();
      fd.append("file", items[i].file);
      let res: BulkResult;
      try {
        res = await bulkProcessResume(fd);
      } catch {
        res = { status: "error", name: "", message: "Request failed" };
      }
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === i
            ? { ...it, status: res.status, message: res.message, name: res.name || it.file.name }
            : it,
        ),
      );
    }
    setRunning(false);
    router.refresh();
  };

  const counts = {
    created: items.filter((i) => i.status === "created").length,
    duplicate: items.filter((i) => i.status === "duplicate").length,
    error: items.filter((i) => i.status === "error").length,
    pending: items.filter((i) => i.status === "pending").length,
  };

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      {/* stat chips */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Chip label="Queued" value={counts.pending + items.filter((i) => i.status === "processing").length} color="#2a6fdb" />
        <Chip label="Created" value={counts.created} color="#16a34a" />
        <Chip label="Duplicates" value={counts.duplicate} color="#f59e0b" />
        <Chip label="Errors" value={counts.error} color="#ef4444" />
      </div>

      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition"
        style={{ borderColor: drag ? "#2a6fdb" : "#cdd7e6", background: drag ? "#f2f7ff" : "#fafbfd" }}
      >
        <UploadCloud size={40} className="text-[#2a6fdb]" />
        <div className="mt-3 text-[15px] font-extrabold text-[#16203a]">
          Drop resumes to upload <span className="font-medium text-[#8a94a6]">(or click)</span>
        </div>
        <div className="mt-1 text-[12px] font-medium text-[#9aa4b6]">
          PDF, DOCX, or TXT · each file &lt; 8 MB · parsed with AI
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); if (e.target) e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={process}
              disabled={running || counts.pending === 0}
              className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-50"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              {running ? "Processing…" : `Process ${counts.pending} resume${counts.pending === 1 ? "" : "s"}`}
            </button>
            {!running && (
              <button onClick={() => setItems([])} className="rounded-[10px] border border-[#e6eaf1] px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-[#f0f3f8] p-[11px_16px] last:border-0">
                <FileText size={16} className="shrink-0 text-[#9aa4b6]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#16203a]">
                    {it.status === "created" || it.status === "duplicate" ? it.name : it.file.name}
                  </div>
                  {it.message && (
                    <div className="truncate text-[11.5px] font-medium text-[#8a94a6]">{it.message}</div>
                  )}
                </div>
                <StatusPill status={it.status} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[13px] border border-[#e9edf3] bg-white p-[13px_18px]">
      <div className="tf-num text-[23px] font-extrabold" style={{ color }}>{value}</div>
      <div className="text-[11.5px] font-semibold text-[#8a94a6]">{label}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Item["status"] }) {
  const map = {
    pending: { t: "Queued", c: "#8a94a6", bg: "#eef1f6", icon: null },
    processing: { t: "Parsing…", c: "#2a6fdb", bg: "#eef4fe", icon: <Loader2 size={12} className="animate-spin" /> },
    created: { t: "Created", c: "#16a34a", bg: "#e9f9ef", icon: <CheckCircle2 size={12} /> },
    duplicate: { t: "Duplicate", c: "#b27400", bg: "#fff7e6", icon: <AlertTriangle size={12} /> },
    error: { t: "Error", c: "#dc2626", bg: "#fef2f2", icon: <XCircle size={12} /> },
  }[status];
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: map.c, background: map.bg }}>
      {map.icon}
      {map.t}
    </span>
  );
}
