"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, StageBadge } from "@/components/bits";
import { useShell } from "@/components/shell-provider";
import { STAGES, type StageKey } from "@/lib/domain";
import { listEmailTemplates } from "@/lib/actions/candidate-message";
import { bulkMoveStage, bulkAssignRecruiter, bulkMessage } from "@/lib/actions/bulk";

type Row = {
  id: string;
  name: string;
  exp_years: number;
  location: string | null;
  jobTitle: string;
  stageKey: StageKey;
  rating: number;
  source: string | null;
  recruiterName: string;
};
type Tmpl = { id: string; name: string; subject: string; body: string };

export function CandidatesBulk({
  rows,
  recruiters,
  isAdmin,
}: {
  rows: Row[];
  recruiters: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { openDrawer } = useShell();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msgOpen, setMsgOpen] = useState(false);
  const [pending, start] = useTransition();

  const allOn = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () => setSel(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  const ids = [...sel];

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setSel(new Set());
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong");
    });

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-[#e9edf3] bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#f7f9fc]">
              <th className="w-[42px] p-[13px_0_13px_18px]">
                <input type="checkbox" checked={allOn} onChange={toggleAll} className="h-4 w-4 cursor-pointer accent-[#2a6fdb]" />
              </th>
              {["Candidate", "Role", "Stage", "Rating", "Source", "Recruiter", ""].map((h) => (
                <th key={h} className="p-[13px_18px] text-left text-[11px] font-bold text-[#8a94a6]">
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => openDrawer(r.id)}
                className="cursor-pointer border-t border-[#f0f3f8] hover:bg-[#f9fbfe]"
              >
                <td className="p-[12px_0_12px_18px]" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={sel.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="h-4 w-4 cursor-pointer accent-[#2a6fdb]"
                  />
                </td>
                <td className="p-[12px_18px]">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.name} size={32} />
                    <div>
                      <div className="text-[13px] font-bold">{r.name}</div>
                      <div className="text-[11px] text-[#9aa4b6]">
                        {r.exp_years}y · {r.location}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">{r.jobTitle}</td>
                <td className="p-[12px_18px]"><StageBadge stage={r.stageKey} /></td>
                <td className="tf-num p-[12px_18px] text-[13px] font-extrabold text-[#b27400]">★ {r.rating.toFixed(1)}</td>
                <td className="p-[12px_18px] text-[12.5px] font-semibold text-[#42506b]">{r.source}</td>
                <td className="p-[12px_18px] text-[13px] font-semibold text-[#42506b]">{r.recruiterName}</td>
                <td className="p-[12px_18px] text-right text-[12px] font-bold text-[#2a6fdb]">View →</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {sel.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-[14px] border border-[#e6eaf1] bg-white px-4 py-2.5 shadow-[0_10px_34px_rgba(20,32,58,.18)]">
          <span className="text-[13px] font-bold text-[#16203a]">{sel.size} selected</span>
          <button
            onClick={() => setMsgOpen(true)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-2 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd] disabled:opacity-50"
          >
            <Mail size={14} /> Email
          </button>
          <select
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const slug = e.target.value;
              e.target.selectedIndex = 0;
              if (slug) run(() => bulkMoveStage(ids, slug));
            }}
            className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[12.5px] font-bold text-[#42506b]"
          >
            <option value="">Move to stage…</option>
            {STAGES.map((s) => (
              <option key={s.slug} value={s.slug}>{s.key}</option>
            ))}
          </select>
          {isAdmin && recruiters.length > 0 && (
            <select
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const rid = e.target.value;
                e.target.selectedIndex = 0;
                if (rid) run(() => bulkAssignRecruiter(ids, rid));
              }}
              className="cursor-pointer rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[12.5px] font-bold text-[#42506b]"
            >
              <option value="">Assign to…</option>
              {recruiters.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setSel(new Set())} className="ml-1 text-[#8a94a6] hover:text-[#42506b]" title="Clear selection">
            <X size={16} />
          </button>
        </div>
      )}

      {msgOpen && (
        <BulkMessageModal
          count={sel.size}
          onClose={() => setMsgOpen(false)}
          onSend={(channel, subject, body) =>
            run(async () => {
              const r = await bulkMessage(ids, channel, subject, body);
              if (r.ok) setMsgOpen(false);
              return r;
            })
          }
        />
      )}
    </>
  );
}

function BulkMessageModal({
  count,
  onClose,
  onSend,
}: {
  count: number;
  onClose: () => void;
  onSend: (channel: "email" | "sms" | "both", subject: string, body: string) => void;
}) {
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  useEffect(() => {
    listEmailTemplates().then(setTemplates).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0e1320]/50 p-4" onClick={onClose}>
      <div className="w-[480px] max-w-full rounded-[16px] bg-white p-[22px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[16px] font-extrabold">Message {count} candidate{count > 1 ? "s" : ""}</div>
          <button onClick={onClose} className="text-[#8a94a6] hover:text-[#42506b]"><X size={18} /></button>
        </div>
        <div className="mb-3 flex gap-1.5 rounded-[10px] bg-[#eef1f6] p-[3px]">
          {(["email", "sms", "both"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className="flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-bold capitalize transition"
              style={channel === c ? { background: "#fff", color: "#2a6fdb", boxShadow: "0 1px 3px rgba(20,40,80,.12)" } : { color: "#7a8696" }}
            >
              {c}
            </button>
          ))}
        </div>
        {templates.length > 0 && (
          <select
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((x) => x.id === e.target.value);
              if (t) { setSubject(t.subject); setBody(t.body); }
              e.target.selectedIndex = 0;
            }}
            className="mb-2 w-full cursor-pointer rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2.5 text-[13px] font-semibold text-[#42506b]"
          >
            <option value="">Insert a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(channel === "email" || channel === "both") && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (email)"
            className="mb-2 w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#2a6fdb] focus:bg-white"
          />
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Message… (use {{name}} to personalise each one)"
          className="w-full resize-none rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-[10px] px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f1f4f9]">Cancel</button>
          <button
            onClick={() => onSend(channel, subject, body)}
            disabled={!body.trim()}
            className="rounded-[10px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-50"
          >
            Send to {count}
          </button>
        </div>
      </div>
    </div>
  );
}
