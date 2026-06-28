"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  createRequisition,
  updateRequisition,
  type ReqForm,
} from "@/lib/actions/mutations";
import type {
  ClientRow,
  EmploymentType,
  JobRow,
  ProfileRow,
} from "@/lib/database.types";

const DEPTS = ["Engineering", "Design", "Product", "Data", "Infrastructure"];
const LOCS = ["Bangalore", "Mumbai", "Pune", "Hyderabad", "Remote"];
const TYPES: { label: string; value: EmploymentType }[] = [
  { label: "Full-time", value: "full_time" },
  { label: "Contract", value: "contract" },
  { label: "Intern", value: "intern" },
];

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

export function JobFormModal({
  open,
  job,
  team,
  clients,
  onClose,
}: {
  open: boolean;
  job: JobRow | null;
  team: ProfileRow[];
  clients: ClientRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const [f, setF] = useState<ReqForm>({
    title: "",
    dept: "Engineering",
    location: "Bangalore",
    type: "full_time",
    openings: 1,
    clientId: clients[0]?.id ?? null,
    recruiterId: team[0]?.id ?? null,
    description: "",
    minCtc: 0,
    maxCtc: 0,
    status: "open",
  });

  useEffect(() => {
    if (!open) return;
    setErr(false);
    if (job) {
      setF({
        title: job.title,
        dept: job.dept,
        location: job.location,
        type: job.type,
        openings: job.openings,
        clientId: job.client_id,
        recruiterId: job.recruiter_id,
        description: job.description,
        minCtc: job.min_ctc_lpa,
        maxCtc: job.max_ctc_lpa,
        status: job.status,
      });
    } else {
      setF((s) => ({
        ...s,
        title: "",
        description: "",
        openings: 1,
        minCtc: 0,
        maxCtc: 0,
        status: "open",
        clientId: clients[0]?.id ?? null,
        recruiterId: team[0]?.id ?? null,
      }));
    }
  }, [open, job, clients, team]);

  if (!open) return null;
  const set = <K extends keyof ReqForm>(k: K, v: ReqForm[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.title.trim()) {
      setErr(true);
      return;
    }
    start(async () => {
      const res = job
        ? await updateRequisition(job.id, f)
        : await createRequisition(f);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        onClose();
        if (!job) router.push("/jobs");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[560px] overflow-y-auto rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
      >
        <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[22px_24px_16px]">
          <div>
            <div className="text-[18px] font-extrabold">
              {job ? "Edit Requisition" : "Create Requisition"}
            </div>
            <div className="text-[12.5px] font-medium text-[#8a94a6]">
              {job ? "Update this role" : "Open a new role and start sourcing"}
            </div>
          </div>
          <button onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-[22px_24px]">
          <label className={labelCls}>
            Job Title <span className="text-[#ef4444]">*</span>
          </label>
          <input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            className={fieldCls}
            style={err ? { borderColor: "#ef4444" } : undefined}
          />
          {err && (
            <div className="mt-1.5 text-[11.5px] font-semibold text-[#ef4444]">
              Please enter a job title.
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <Field label="Department">
              <select value={f.dept} onChange={(e) => set("dept", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Location">
              <select value={f.location} onChange={(e) => set("location", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                {LOCS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Employment Type">
              <select value={f.type} onChange={(e) => set("type", e.target.value as EmploymentType)} className={`${fieldCls} cursor-pointer`}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Openings">
              <input type="number" min={1} value={f.openings} onChange={(e) => set("openings", Number(e.target.value))} className={fieldCls} />
            </Field>
            <Field label="Budget — Min CTC (₹ LPA)">
              <input type="number" min={0} step={0.5} value={f.minCtc} onChange={(e) => set("minCtc", Number(e.target.value))} className={fieldCls} />
            </Field>
            <Field label="Budget — Max CTC (₹ LPA)">
              <input type="number" min={0} step={0.5} value={f.maxCtc} onChange={(e) => set("maxCtc", Number(e.target.value))} className={fieldCls} />
            </Field>
            <Field label="Client">
              <select value={f.clientId ?? ""} onChange={(e) => set("clientId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Assign Recruiter">
              <select value={f.recruiterId ?? ""} onChange={(e) => set("recruiterId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            {job && (
              <Field label="Status">
                <select value={f.status} onChange={(e) => set("status", e.target.value as ReqForm["status"])} className={`${fieldCls} cursor-pointer`}>
                  <option value="open">Open</option>
                  <option value="hot">Hot</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
            )}
          </div>

          <label className={`${labelCls} mt-4`}>Description</label>
          <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Role summary, must-have skills, responsibilities…" className={`${fieldCls} resize-y font-medium`} />
        </div>

        <div className="flex gap-2.5 border-t border-[#f0f3f8] p-[16px_24px]">
          <button onClick={onClose} className="flex-1 rounded-[11px] border border-[#e6eaf1] py-3 text-[13.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">
            Cancel
          </button>
          <button onClick={submit} disabled={pending} className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60">
            {job ? "Save Changes" : "Create & Publish Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
