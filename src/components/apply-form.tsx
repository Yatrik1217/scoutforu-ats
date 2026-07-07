"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2.5 text-[14px] outline-none focus:border-[#2a6fdb]";

export function ApplyForm({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("jobId", jobId);
    if (!(fd.get("name") as string)?.trim() || !(fd.get("email") as string)?.trim()) {
      setError("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/careers/apply", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({ ok: false }));
      if (json.ok) setDone(true);
      else setError(json.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[#bbf7d0] bg-[#f0fdf4] p-5">
        <CheckCircle2 className="text-[#16a34a]" />
        <div>
          <div className="text-[15px] font-extrabold text-[#16203a]">Application received!</div>
          <div className="text-[13px] text-[#6b7686]">
            Thanks for applying to {jobTitle}. Our team will be in touch.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" placeholder="Full name *" className={field} />
        <input name="email" type="email" placeholder="Email *" className={field} />
        <input name="phone" placeholder="Phone" className={field} />
        <input name="currentCompany" placeholder="Current company" className={field} />
        <input name="expYears" type="number" step="0.1" min="0" placeholder="Experience (years)" className={field} />
        <input name="location" placeholder="Current location" className={field} />
      </div>
      <textarea name="message" rows={3} placeholder="A short note (optional)" className={field + " resize-none"} />
      <label className="block text-[12.5px] font-bold text-[#42506b]">
        Résumé (PDF / Word)
        <input
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx"
          className="mt-1 block w-full text-[13px] text-[#6b7686] file:mr-3 file:rounded-[8px] file:border-0 file:bg-[#eef4fe] file:px-3 file:py-2 file:text-[12px] file:font-bold file:text-[#2a6fdb]"
        />
      </label>
      {error && <div className="text-[12.5px] font-semibold text-[#dc2626]">{error}</div>}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#2a6fdb] py-3 text-[14px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
