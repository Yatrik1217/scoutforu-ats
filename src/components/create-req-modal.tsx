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
import {
  INDIAN_CITIES,
  FUNCTIONAL_AREAS,
  INDUSTRIES,
  QUALIFICATIONS,
} from "@/lib/domain";
import type {
  ClientRow,
  EmploymentType,
  JobRow,
  ProfileRow,
} from "@/lib/database.types";

const DEPTS = ["Engineering", "Design", "Product", "Data", "Infrastructure"];
const TYPES: { label: string; value: EmploymentType }[] = [
  { label: "Full-time", value: "full_time" },
  { label: "Contract", value: "contract" },
  { label: "Intern", value: "intern" },
];

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

// Numeric fields are held as strings so they're freely typeable (clear, decimals
// like 5.5, etc.) and only coerced to numbers on submit.
type FormState = Omit<
  ReqForm,
  "openings" | "expMin" | "expMax" | "minCtc" | "maxCtc"
> & {
  openings: string;
  expMin: string;
  expMax: string;
  minCtc: string;
  maxCtc: string;
};

const blank = (clients: ClientRow[], team: ProfileRow[]): FormState => ({
  title: "",
  designation: "",
  dept: "Engineering",
  location: "Bangalore",
  type: "full_time",
  openings: "1",
  targetDate: "",
  referenceCode: "",
  clientId: clients[0]?.id ?? null,
  recruiterId: team[0]?.id ?? null,
  interviewerHr: "",
  interviewVenue: "",
  remoteWork: false,
  expMin: "",
  expMax: "",
  functionalArea: "",
  industry: "",
  qualification: "",
  keywords: "",
  minCtc: "",
  maxCtc: "",
  hideSalary: false,
  description: "",
  profileCriteria: "",
  benefits: "",
  walkIn: false,
  telephonic: false,
  status: "open",
});

const numStr = (n: number) => (n ? String(n) : "");

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
  const [f, setF] = useState<FormState>(blank(clients, team));

  useEffect(() => {
    if (!open) return;
    setErr(false);
    if (job) {
      setF({
        title: job.title,
        designation: job.designation,
        dept: job.dept,
        location: job.location,
        type: job.type,
        openings: String(job.openings || 1),
        targetDate: job.target_date ?? "",
        referenceCode: job.reference_code,
        clientId: job.client_id,
        recruiterId: job.recruiter_id,
        interviewerHr: job.interviewer_hr,
        interviewVenue: job.interview_venue,
        remoteWork: job.remote_work,
        expMin: numStr(job.exp_min),
        expMax: numStr(job.exp_max),
        functionalArea: job.functional_area,
        industry: job.industry,
        qualification: job.qualification,
        keywords: job.keywords,
        minCtc: numStr(job.min_ctc_lpa),
        maxCtc: numStr(job.max_ctc_lpa),
        hideSalary: job.hide_salary,
        description: job.description,
        profileCriteria: job.profile_criteria,
        benefits: job.benefits,
        walkIn: job.walk_in,
        telephonic: job.telephonic,
        status: job.status,
      });
    } else {
      setF(blank(clients, team));
    }
  }, [open, job, clients, team]);

  if (!open) return null;
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.title.trim()) {
      setErr(true);
      return;
    }
    const payload: ReqForm = {
      ...f,
      openings: parseInt(f.openings) || 1,
      expMin: parseFloat(f.expMin) || 0,
      expMax: parseFloat(f.expMax) || 0,
      minCtc: parseFloat(f.minCtc) || 0,
      maxCtc: parseFloat(f.maxCtc) || 0,
    };
    start(async () => {
      const res = job
        ? await updateRequisition(job.id, payload)
        : await createRequisition(payload);
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
      <datalist id="india-cities">
        {INDIAN_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-[760px] max-w-full overflow-y-auto rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0f3f8] bg-white p-[22px_24px_16px]">
          <div>
            <div className="text-[18px] font-extrabold">
              {job ? "Edit Job Opening" : "Create New Job Opening"}
            </div>
            <div className="text-[12.5px] font-medium text-[#8a94a6]">
              {job ? "Update this role" : "Capture full requisition detail"}
            </div>
          </div>
          <button onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div className="space-y-5 p-[20px_24px]">
          {/* Basic */}
          <Section title="Job Title & Basic Information" />
          <div>
            <label className={labelCls}>
              Job Opening Title <span className="text-[#ef4444]">*</span>
            </label>
            <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Senior Backend Engineer" className={fieldCls} style={err ? { borderColor: "#ef4444" } : undefined} />
            {err && <div className="mt-1.5 text-[11.5px] font-semibold text-[#ef4444]">Please enter a job title.</div>}
          </div>
          <div className="grid grid-cols-4 gap-3.5">
            <Field label="Designation"><input value={f.designation} onChange={(e) => set("designation", e.target.value)} className={fieldCls} placeholder="e.g. SDE II" /></Field>
            <Field label="Vacancies"><input inputMode="numeric" value={f.openings} onChange={(e) => set("openings", e.target.value.replace(/[^0-9]/g, ""))} className={fieldCls} placeholder="1" /></Field>
            <Field label="Target Date"><input type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} className={fieldCls} /></Field>
            <Field label="Reference Code"><input value={f.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} className={fieldCls} placeholder="REF-001" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Department">
              <select value={f.dept} onChange={(e) => set("dept", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Employment Type">
              <select value={f.type} onChange={(e) => set("type", e.target.value as EmploymentType)} className={`${fieldCls} cursor-pointer`}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Client */}
          <Section title="Client Information" />
          <div className="grid grid-cols-3 gap-3.5">
            <Field label="Client">
              <select value={f.clientId ?? ""} onChange={(e) => set("clientId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select client —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Assign Recruiter">
              <select value={f.recruiterId ?? ""} onChange={(e) => set("recruiterId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Unassigned —</option>
                {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Interviewer HR Person"><input value={f.interviewerHr} onChange={(e) => set("interviewerHr", e.target.value)} className={fieldCls} placeholder="HR contact name" /></Field>
          </div>
          <Field label="Interview Venue"><input value={f.interviewVenue} onChange={(e) => set("interviewVenue", e.target.value)} className={fieldCls} placeholder="Office address / video link" /></Field>

          {/* Location */}
          <Section title="Work Location" />
          <div className="grid grid-cols-[1fr_auto] items-end gap-4">
            <Field label="City">
              <input list="india-cities" value={f.location} onChange={(e) => set("location", e.target.value)} className={fieldCls} placeholder="Type any city in India…" />
            </Field>
            <label className="flex items-center gap-2 pb-2.5 text-[13px] font-bold text-[#42506b]">
              <input type="checkbox" checked={f.remoteWork} onChange={(e) => set("remoteWork", e.target.checked)} className="h-4 w-4" />
              Remote Work
            </label>
          </div>

          {/* Employment details */}
          <Section title="Employment Details" />
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Experience — From (yrs)"><input inputMode="decimal" value={f.expMin} onChange={(e) => set("expMin", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 3" /></Field>
            <Field label="Experience — To (yrs)"><input inputMode="decimal" value={f.expMax} onChange={(e) => set("expMax", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 6" /></Field>
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3.5">
            <Field label="CTC — Min (₹ LPA)"><input inputMode="decimal" value={f.minCtc} onChange={(e) => set("minCtc", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 5" /></Field>
            <Field label="CTC — Max (₹ LPA)"><input inputMode="decimal" value={f.maxCtc} onChange={(e) => set("maxCtc", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 7" /></Field>
            <label className="flex items-center gap-2 pb-2.5 text-[13px] font-bold text-[#42506b]">
              <input type="checkbox" checked={f.hideSalary} onChange={(e) => set("hideSalary", e.target.checked)} className="h-4 w-4" />
              Hide CTC
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Functional Area">
              <select value={f.functionalArea} onChange={(e) => set("functionalArea", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {FUNCTIONAL_AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Industry">
              <select value={f.industry} onChange={(e) => set("industry", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {INDUSTRIES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Qualification">
              <select value={f.qualification} onChange={(e) => set("qualification", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {QUALIFICATIONS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Keywords"><input value={f.keywords} onChange={(e) => set("keywords", e.target.value)} className={fieldCls} placeholder="React, Node, AWS (comma-separated)" /></Field>
          </div>

          {/* Description */}
          <Section title="Description" />
          <Field label="Job Description"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} className={`${fieldCls} resize-y font-medium`} placeholder="Provide job description in detail. Helps job-seekers understand the requirement." /></Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Profile Criteria / Required Skills"><textarea value={f.profileCriteria} onChange={(e) => set("profileCriteria", e.target.value)} rows={3} className={`${fieldCls} resize-y font-medium`} placeholder="Must-have skills, compulsory credentials" /></Field>
            <Field label="Benefits"><textarea value={f.benefits} onChange={(e) => set("benefits", e.target.value)} rows={3} className={`${fieldCls} resize-y font-medium`} placeholder="Perks & benefits" /></Field>
          </div>

          {/* Interview schedules */}
          <Section title="Interview Schedules" />
          <div className="flex gap-8">
            <label className="flex items-center gap-2 text-[13px] font-bold text-[#42506b]">
              <input type="checkbox" checked={f.walkIn} onChange={(e) => set("walkIn", e.target.checked)} className="h-4 w-4" />
              Walk-In Interview
            </label>
            <label className="flex items-center gap-2 text-[13px] font-bold text-[#42506b]">
              <input type="checkbox" checked={f.telephonic} onChange={(e) => set("telephonic", e.target.checked)} className="h-4 w-4" />
              Telephonic Interview
            </label>
            {job && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#42506b]">Status</span>
                <select value={f.status} onChange={(e) => set("status", e.target.value as ReqForm["status"])} className="cursor-pointer rounded-[9px] border border-[#e3e8f0] px-2.5 py-1.5 text-[12.5px] font-semibold">
                  <option value="open">Open</option>
                  <option value="hot">Hot</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-[#f0f3f8] bg-white p-[16px_24px]">
          <button onClick={onClose} className="flex-1 rounded-[11px] border border-[#e6eaf1] py-3 text-[13.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60">
            {job ? "Save Changes" : "Save & Publish Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="border-b border-[#eef1f6] pb-1.5 text-[13px] font-extrabold text-[#16203a]">
      {title}
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
