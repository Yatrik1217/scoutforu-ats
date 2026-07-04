"use client";

import { useMemo, useState, useTransition } from "react";
import { Send, X, Search } from "lucide-react";
import { toast } from "sonner";
import { shareWithClient } from "@/lib/actions/share";

type Cand = {
  id: string;
  name: string;
  jobTitle: string;
  stageKey: string;
  exp_years: number;
  location: string | null;
};
type ClientOpt = { name: string; email: string };

export function ShareClientButton({
  candidates,
  clients,
}: {
  candidates: Cand[];
  clients: ClientOpt[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
      >
        <Send size={15} />
        Share with Client
      </button>
      {open && <ShareModal candidates={candidates} clients={clients} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareModal({
  candidates,
  clients,
  onClose,
}: {
  candidates: Cand[];
  clients: ClientOpt[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(candidates.map((c) => c.id)));
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s
      ? candidates.filter(
          (c) => c.name.toLowerCase().includes(s) || (c.jobTitle || "").toLowerCase().includes(s),
        )
      : candidates;
  }, [q, candidates]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allShown = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allShown) filtered.forEach((c) => n.delete(c.id));
      else filtered.forEach((c) => n.add(c.id));
      return n;
    });

  const send = () => {
    if (!selected.size) return toast.error("Select at least one candidate.");
    if (!to.trim()) return toast.error("Enter the client's email address.");
    start(async () => {
      const res = await shareWithClient({
        candidateIds: [...selected],
        to,
        cc,
        subject,
        message,
      });
      if (res.ok) {
        toast.success(res.message || "Email sent to client.");
        onClose();
      } else {
        toast.error(res.error || "Failed to send.");
      }
    });
  };

  const input =
    "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">Share candidates with client</h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[12px] font-bold text-[#42506b]">
              Client email <span className="text-[#dc2626]">*</span>
              <input
                list="sfu-client-emails"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="hr@client.com"
                className={input + " mt-1 font-normal"}
              />
              <datalist id="sfu-client-emails">
                {clients.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="text-[12px] font-bold text-[#42506b]">
              CC (optional)
              <input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="you@scoutforu.com"
                className={input + " mt-1 font-normal"}
              />
            </label>
          </div>

          <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={`Candidate submission — ${selected.size} profile${selected.size === 1 ? "" : "s"}`}
              className={input + " mt-1 font-normal"}
            />
          </label>

          <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi, please find the shortlisted candidates attached…"
              className={input + " mt-1 resize-none font-normal"}
            />
          </label>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#42506b]">
              {selected.size} of {candidates.length} selected
            </span>
            <button onClick={toggleAll} className="text-[12px] font-bold text-[#2a6fdb]">
              {allShown ? "Clear shown" : "Select shown"}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-[9px] border border-[#e3e8f0] px-3 py-2">
            <Search size={14} className="text-[#9aa4b6]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter candidates…"
              className="w-full text-[13px] outline-none"
            />
          </div>

          <div className="mt-2 max-h-[240px] overflow-auto rounded-[10px] border border-[#eef1f6]">
            {filtered.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 border-b border-[#f4f6fa] px-3 py-2 last:border-b-0 hover:bg-[#f9fbfe]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 accent-[#2a6fdb]"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-[#16203a]">{c.name}</div>
                  <div className="truncate text-[11px] text-[#9aa4b6]">
                    {c.jobTitle || "—"} · {c.exp_years}y · {c.location || "—"}
                  </div>
                </div>
              </label>
            ))}
            {!filtered.length && (
              <div className="px-3 py-6 text-center text-[12px] text-[#9aa4b6]">No candidates.</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eef1f6] px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-[9px] border border-[#e6eaf1] bg-white px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            <Send size={14} />
            {pending ? "Sending…" : "Send to client"}
          </button>
        </div>
      </div>
    </div>
  );
}
