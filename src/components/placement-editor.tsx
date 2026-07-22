"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { savePlacement, type PlacementForm } from "@/lib/actions/placements";
import { computeFee, addDaysISO, CREDIT_TERMS, GUARANTEE_TERMS } from "@/lib/placement";
import { money } from "@/lib/invoice";
import { NumberInput } from "@/components/number-input";
import type { PlacementRow, PlacementFeeMode, PlacementTdsBase } from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const label = "block text-[12px] font-bold text-[#42506b]";

export type ClientLite = { id: string; name: string };
export type CandidateLite = {
  id: string;
  name: string;
  designation: string;
  expectedCtc: number; // rupees/annum
  clientId: string | null;
  jobId: string | null;
  recruiterId: string | null;
};
export type RecruiterLite = { id: string; name: string };

export function PlacementEditor({
  clients,
  candidates,
  recruiters,
  gstDefault,
  placement,
}: {
  clients: ClientLite[];
  candidates: CandidateLite[];
  recruiters: RecruiterLite[];
  gstDefault: number;
  placement?: PlacementRow;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<PlacementForm>({
    candidateId: placement?.candidate_id ?? null,
    candidateName: placement?.candidate_name ?? "",
    position: placement?.position ?? "",
    clientId: placement?.client_id ?? null,
    clientName: placement?.client_name ?? "",
    jobId: placement?.job_id ?? null,
    recruiterId: placement?.recruiter_id ?? null,
    joiningDate: placement?.joining_date ?? today,
    feeMode: placement?.fee_mode ?? "percent",
    annualCtc: placement?.annual_ctc ?? 0,
    feePercent: placement?.fee_percent ?? 8.33,
    flatFee: placement?.fee_mode === "flat" ? (placement?.fee_amount ?? 0) : 0,
    gstApplicable: placement?.gst_applicable ?? true,
    gstPercent: placement?.gst_percent ?? gstDefault,
    tdsApplicable: placement?.tds_applicable ?? true,
    tdsPercent: placement?.tds_percent ?? 10,
    tdsOn: placement?.tds_on ?? "total",
    creditDays: placement?.credit_days ?? 30,
    replacementDays: placement?.replacement_days ?? 90,
    notes: placement?.notes ?? "",
  });
  const [pending, start] = useTransition();

  const set = <K extends keyof PlacementForm>(k: K, v: PlacementForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const pickCandidate = (id: string) => {
    const c = candidates.find((x) => x.id === id);
    if (!c) {
      set("candidateId", null);
      return;
    }
    setF((p) => ({
      ...p,
      candidateId: c.id,
      candidateName: c.name,
      position: p.position || c.designation,
      annualCtc: c.expectedCtc || p.annualCtc,
      clientId: c.clientId ?? p.clientId,
      clientName: c.clientId ? (clients.find((cl) => cl.id === c.clientId)?.name ?? p.clientName) : p.clientName,
      jobId: c.jobId ?? p.jobId,
      recruiterId: c.recruiterId ?? p.recruiterId,
    }));
  };

  const pickClient = (id: string) => {
    setF((p) => ({
      ...p,
      clientId: id || null,
      clientName: id ? (clients.find((c) => c.id === id)?.name ?? p.clientName) : p.clientName,
    }));
  };

  const fee = useMemo(
    () =>
      computeFee({
        feeMode: f.feeMode,
        annualCtc: f.annualCtc,
        feePercent: f.feePercent,
        flatFee: f.flatFee,
        gstApplicable: f.gstApplicable,
        gstPercent: f.gstPercent,
        tdsApplicable: f.tdsApplicable,
        tdsPercent: f.tdsPercent,
        tdsOn: f.tdsOn,
      }),
    [
      f.feeMode,
      f.annualCtc,
      f.feePercent,
      f.flatFee,
      f.gstApplicable,
      f.gstPercent,
      f.tdsApplicable,
      f.tdsPercent,
      f.tdsOn,
    ],
  );
  const dueDate = f.joiningDate ? addDaysISO(f.joiningDate, Math.max(0, f.creditDays)) : "—";
  const guaranteeUntil =
    f.joiningDate && f.replacementDays > 0 ? addDaysISO(f.joiningDate, f.replacementDays) : "—";

  const save = () =>
    start(async () => {
      const res = await savePlacement(placement?.id ?? null, f);
      if (res.ok && res.id) {
        toast.success(res.message || "Saved");
        router.push(`/placements/${res.id}`);
      } else toast.error(res.error || "Failed to save");
    });

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="grid grid-cols-2 gap-[18px]">
        {/* who + where */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-3 text-[13px] font-extrabold text-[#16203a]">Hire</div>
          <label className={label}>
            Link a candidate (optional — autofills)
            <select
              value={f.candidateId ?? ""}
              onChange={(e) => pickCandidate(e.target.value)}
              className={field + " mt-1 font-normal"}
            >
              <option value="">— Not in the ATS / type manually —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.designation ? ` · ${c.designation}` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Candidate name*
              <input
                value={f.candidateName}
                onChange={(e) => set("candidateName", e.target.value)}
                className={field + " mt-1 font-normal"}
                placeholder="Nupur Naik"
              />
            </label>
            <label className={label}>
              Position
              <input
                value={f.position}
                onChange={(e) => set("position", e.target.value)}
                className={field + " mt-1 font-normal"}
                placeholder="Senior Accountant"
              />
            </label>
          </div>
          <label className={label + " mt-3"}>
            Client*
            <select
              value={f.clientId ?? ""}
              onChange={(e) => pickClient(e.target.value)}
              className={field + " mt-1 font-normal"}
            >
              <option value="">— Type a one-off client below —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!f.clientId && (
            <input
              value={f.clientName}
              onChange={(e) => set("clientName", e.target.value)}
              className={field + " mt-2 font-normal"}
              placeholder="Client name (one-off)"
            />
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Date of joining*
              <input
                type="date"
                value={f.joiningDate}
                onChange={(e) => set("joiningDate", e.target.value)}
                className={field + " mt-1 font-normal"}
              />
            </label>
            <label className={label}>
              Recruiter
              <select
                value={f.recruiterId ?? ""}
                onChange={(e) => set("recruiterId", e.target.value || null)}
                className={field + " mt-1 font-normal"}
              >
                <option value="">—</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* fee + terms */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-3 text-[13px] font-extrabold text-[#16203a]">Fee & payment terms</div>
          <div className="mb-3 flex gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
            {(["percent", "flat"] as PlacementFeeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("feeMode", m)}
                className={`flex-1 rounded-[8px] px-2 py-1.5 text-[12px] font-bold transition ${
                  f.feeMode === m ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
                }`}
              >
                {m === "percent" ? "% of CTC" : "Flat fee"}
              </button>
            ))}
          </div>

          {f.feeMode === "percent" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Annual CTC (₹)
                <NumberInput
                  value={f.annualCtc}
                  onChange={(n) => set("annualCtc", n)}
                  className={field + " mt-1 font-normal"}
                  placeholder="1200000"
                />
              </label>
              <label className={label}>
                Fee %
                <NumberInput
                  value={f.feePercent}
                  onChange={(n) => set("feePercent", n)}
                  className={field + " mt-1 font-normal"}
                  placeholder="8.33"
                />
              </label>
            </div>
          ) : (
            <label className={label}>
              Flat fee (₹)
              <NumberInput
                value={f.flatFee}
                onChange={(n) => set("flatFee", n)}
                className={field + " mt-1 font-normal"}
                placeholder="100000"
              />
            </label>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Payment due
              <select
                value={f.creditDays}
                onChange={(e) => set("creditDays", parseInt(e.target.value) || 0)}
                className={field + " mt-1 font-normal"}
              >
                {CREDIT_TERMS.map((t) => (
                  <option key={t.days} value={t.days}>
                    {t.label} from DOJ
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Replacement guarantee
              <select
                value={f.replacementDays}
                onChange={(e) => set("replacementDays", parseInt(e.target.value) || 0)}
                className={field + " mt-1 font-normal"}
              >
                {GUARANTEE_TERMS.map((t) => (
                  <option key={t.days} value={t.days}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#42506b]">
            <input
              type="checkbox"
              checked={f.gstApplicable}
              onChange={(e) => set("gstApplicable", e.target.checked)}
              className="h-4 w-4 accent-[#2a6fdb]"
            />
            Add GST
            {f.gstApplicable && (
              <NumberInput
                value={f.gstPercent}
                onChange={(n) => set("gstPercent", n)}
                className="ml-1 w-[64px] rounded-[8px] border border-[#e3e8f0] px-2 py-1 text-[12px] font-normal outline-none focus:border-[#2a6fdb]"
              />
            )}
            {f.gstApplicable && <span className="font-normal text-[#8a94a6]">%</span>}
          </label>

          <label className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#42506b]">
            <input
              type="checkbox"
              checked={f.tdsApplicable}
              onChange={(e) => set("tdsApplicable", e.target.checked)}
              className="h-4 w-4 accent-[#2a6fdb]"
            />
            Client deducts TDS
            {f.tdsApplicable && (
              <>
                <NumberInput
                  value={f.tdsPercent}
                  onChange={(n) => set("tdsPercent", n)}
                  className="ml-1 w-[56px] rounded-[8px] border border-[#e3e8f0] px-2 py-1 text-[12px] font-normal outline-none focus:border-[#2a6fdb]"
                />
                <span className="font-normal text-[#8a94a6]">% on</span>
                <select
                  value={f.tdsOn}
                  onChange={(e) => set("tdsOn", e.target.value as PlacementTdsBase)}
                  className="rounded-[8px] border border-[#e3e8f0] px-2 py-1 text-[12px] font-normal outline-none focus:border-[#2a6fdb]"
                >
                  <option value="total">Total (incl GST)</option>
                  <option value="fee">Fee (excl GST)</option>
                </select>
              </>
            )}
          </label>

          {/* live summary */}
          <div className="mt-4 space-y-1.5 rounded-[12px] bg-[#f8fafc] p-4 text-[13px]">
            <Row label="Base fee" value={money(fee.fee)} />
            {f.gstApplicable && <Row label={`GST (${f.gstPercent}%)`} value={money(fee.gst)} />}
            <div className="flex items-center justify-between border-t border-[#e3e8f0] pt-2">
              <span className="font-semibold text-[#7a8696]">Invoice total (incl GST)</span>
              <span className="tf-num font-bold text-[#16203a]">{money(fee.total)}</span>
            </div>
            {f.tdsApplicable && (
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#7a8696]">
                  Less: TDS ({f.tdsPercent}% on {f.tdsOn === "fee" ? "fee" : "total"})
                </span>
                <span className="tf-num font-bold text-[#dc2626]">- {money(fee.tds)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-[#e3e8f0] pt-2">
              <span className="text-[13.5px] font-extrabold text-[#16203a]">
                Net client pays
              </span>
              <span className="tf-num text-[16px] font-extrabold text-[#16a34a]">
                {money(fee.net)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 text-[11.5px] font-semibold text-[#8a94a6]">
              <span>Payment due</span>
              <span className="font-extrabold text-[#16203a]">{dueDate}</span>
            </div>
            <div className="flex items-center justify-between text-[11.5px] font-semibold text-[#8a94a6]">
              <span>Guarantee until</span>
              <span className="font-extrabold text-[#16203a]">{guaranteeUntil}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
        <label className={label}>
          Notes
          <textarea
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className={field + " mt-1 resize-none font-normal"}
            placeholder="Any context — replacement terms, split fee, PO number…"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-bold text-[#8a94a6] hover:bg-[#eef1f6]"
        >
          <ArrowLeft size={14} /> Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Save size={15} />
          {pending ? "Saving…" : placement ? "Save changes" : "Record placement"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-[#7a8696]">{label}</span>
      <span className="tf-num font-bold text-[#16203a]">{value}</span>
    </div>
  );
}
