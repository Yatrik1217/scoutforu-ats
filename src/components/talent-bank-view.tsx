"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FolderOpen, Trash2, FileText } from "lucide-react";
import { promoteFromTalentBank, deleteTalentBank } from "@/lib/actions/talent-bank";
import type { TalentBankRow } from "@/lib/database.types";

const CAT_COLOR: Record<string, string> = {
  ".NET": "#8b5cf6",
  Java: "#e8833a",
  "Python / Data": "#2a6fdb",
  "PL-SQL / Oracle": "#dc2626",
  "Frontend / UI": "#06b6d4",
  "Node.js / Backend JS": "#16a34a",
  Mobile: "#ec4899",
  "DevOps / Cloud": "#f59e0b",
  "Data Science / AI": "#6366f1",
  "QA / Testing": "#14b8a6",
  "Sales / BDE": "#0ea5e9",
};
const colorOf = (c: string) => CAT_COLOR[c] ?? "#64748b";

export function TalentBankView({
  rows,
  jobs,
}: {
  rows: TalentBankRow[];
  jobs: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        (r.current_designation ?? "").toLowerCase().includes(needle) ||
        (r.current_company ?? "").toLowerCase().includes(needle) ||
        (r.skills ?? []).some((s) => s.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const groups = useMemo(() => {
    const m = new Map<string, TalentBankRow[]>();
    for (const r of filtered) {
      const arr = m.get(r.category) ?? [];
      arr.push(r);
      m.set(r.category, arr);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const toggle = (c: string) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const promote = (id: string, jobId: string, name: string) => {
    if (!jobId) return;
    start(async () => {
      const res = await promoteFromTalentBank(id, jobId);
      if (res.ok) toast.success(res.message || `${name} added`);
      else toast.error(res.error || "Failed");
      router.refresh();
    });
  };
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteTalentBank(id);
      if (res.ok) toast.success(res.message || "Removed");
      else toast.error(res.error || "Failed");
      router.refresh();
    });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, skill, company…"
          className="w-[280px] max-w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
        />
        <span className="text-[12.5px] font-semibold text-[#8a94a6]">
          {filtered.length} in bank · {groups.length} categories
        </span>
      </div>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-[#e9edf3] bg-white py-14 text-center text-[13px] font-semibold text-[#a3acbd]">
          Nothing here yet — dump some resumes above.
        </div>
      )}

      <div className="space-y-2.5">
        {groups.map(([cat, items]) => {
          const expanded = open.has(cat) || !!q.trim();
          const color = colorOf(cat);
          return (
            <div key={cat} className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
              <button
                onClick={() => toggle(cat)}
                className="flex w-full items-center gap-2.5 px-4 py-3 hover:bg-[#f8fafc]"
              >
                {expanded ? <ChevronDown size={16} className="text-[#8a94a6]" /> : <ChevronRight size={16} className="text-[#8a94a6]" />}
                <FolderOpen size={17} style={{ color }} />
                <span className="text-[14px] font-extrabold text-[#16203a]">{cat}</span>
                <span
                  className="tf-num ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-extrabold"
                  style={{ color, background: `${color}1a` }}
                >
                  {items.length}
                </span>
              </button>

              {expanded && (
                <div className="border-t border-[#eef1f6]">
                  {items.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center gap-3 border-b border-[#f4f6fa] px-4 py-3 last:border-0"
                    >
                      <div className="min-w-[180px] flex-1">
                        <div className="text-[13px] font-bold text-[#16203a]">{t.name}</div>
                        <div className="text-[11.5px] text-[#8a94a6]">
                          {t.exp_years}y exp
                          {t.current_designation ? ` · ${t.current_designation}` : ""}
                          {t.current_company ? ` @ ${t.current_company}` : ""}
                          {t.location ? ` · ${t.location}` : ""}
                        </div>
                        {t.skills?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {t.skills.slice(0, 8).map((s) => (
                              <span
                                key={s}
                                className="rounded-md bg-[#eef2f8] px-1.5 py-[2px] text-[10px] font-semibold text-[#556680]"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {t.resume_url && t.resume_url.startsWith("http") && (
                        <a
                          href={t.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[12px] font-bold text-[#2a6fdb] hover:underline"
                        >
                          <FileText size={13} /> Resume
                        </a>
                      )}

                      <select
                        defaultValue=""
                        disabled={pending}
                        onChange={(e) => promote(t.id, e.target.value, t.name)}
                        className="cursor-pointer rounded-[8px] border border-[#e3e8f0] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#42506b] outline-none focus:border-[#2a6fdb] disabled:opacity-50"
                        title="Move this person into an opening"
                      >
                        <option value="">Add to opening…</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => remove(t.id)}
                        disabled={pending}
                        className="text-[#c2cad6] hover:text-[#dc2626] disabled:opacity-40"
                        title="Remove from Talent Bank"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
