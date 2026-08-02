"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, X, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { messageCandidate } from "@/lib/actions/candidate-message";

// "Message" action for the candidate drawer — sends an email and/or SMS to the
// candidate from inside the ATS (uses the company's SMTP + SMS provider).
export function CandidateMessageModal({
  candidate,
}: {
  candidate: { id: string; name: string; email: string | null; phone: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "sms" | "both">(
    candidate.email ? "email" : "sms",
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  const wantEmail = channel === "email" || channel === "both";
  const wantSms = channel === "sms" || channel === "both";

  const send = () =>
    start(async () => {
      const res = await messageCandidate({ candidateId: candidate.id, channel, subject, body });
      if (res.ok) {
        toast.success(res.message ?? "Sent");
        setOpen(false);
        setSubject("");
        setBody("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't send");
      }
    });

  const opt = (
    id: "email" | "sms" | "both",
    label: string,
    Icon: typeof Mail,
    disabled: boolean,
  ) => (
    <button
      key={id}
      disabled={disabled}
      onClick={() => setChannel(id)}
      title={disabled ? "Missing email/phone on this candidate" : ""}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition disabled:opacity-40"
      style={
        channel === id
          ? { background: "#fff", color: "#2a6fdb", boxShadow: "0 1px 3px rgba(20,40,80,.12)" }
          : { color: "#7a8696" }
      }
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
      >
        <MessageSquare size={15} /> Message
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0e1320]/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-[460px] max-w-full rounded-[16px] bg-white p-[22px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[16px] font-extrabold">Message {candidate.name}</div>
              <button onClick={() => setOpen(false)} className="text-[#8a94a6] hover:text-[#42506b]">
                <X size={18} />
              </button>
            </div>

            <div className="mb-3 flex gap-1.5 rounded-[10px] bg-[#eef1f6] p-[3px]">
              {opt("email", "Email", Mail, !candidate.email)}
              {opt("sms", "SMS", Phone, !candidate.phone)}
              {opt("both", "Both", MessageSquare, !candidate.email || !candidate.phone)}
            </div>

            <div className="mb-2 text-[11px] font-semibold text-[#8a94a6]">
              {wantEmail && <>Email: {candidate.email ?? "—"}</>}
              {wantEmail && wantSms && " · "}
              {wantSms && <>SMS: {candidate.phone ?? "—"}</>}
            </div>

            {wantEmail && (
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
              placeholder="Write your message…"
              className="w-full resize-none rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2.5 text-[13px] font-medium outline-none focus:border-[#2a6fdb] focus:bg-white"
            />
            {wantSms && (
              <div className="mt-1 text-[10.5px] text-[#9aa4b6]">
                SMS sends the message text only (no subject).
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-[10px] px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f1f4f9]"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={pending || !body.trim()}
                className="rounded-[10px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-50"
              >
                {pending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
