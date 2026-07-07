"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, FileUp, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createCandidate,
  updateCandidate,
  findDuplicateCandidate,
  type CandidateForm,
  type DuplicateMatch,
} from "@/lib/actions/mutations";
import { parseResume } from "@/lib/actions/parse-resume";
import { useShell } from "@/components/shell-provider";
import { AlertTriangle } from "lucide-react";
import {
  STAGES,
  SOURCES,
  INDIAN_CITIES,
  GENDERS,
  MARITAL_STATUSES,
  QUALIFICATIONS,
  FUNCTIONAL_AREAS,
  INDUSTRIES,
  stageToSlug,
  stageFromSlug,
} from "@/lib/domain";
import type {
  CandidateRow,
  CandidateStage,
  CustomFieldRow,
  CustomValues,
  ProfileRow,
} from "@/lib/database.types";

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

// Numeric fields kept as strings so they're freely typeable; coerced on submit.
type CForm = Omit<
  CandidateForm,
  "expYears" | "rating" | "currentCtc" | "expectedCtc" | "noticePeriod"
> & {
  expYears: string;
  rating: string;
  currentCtc: string;
  expectedCtc: string;
  noticePeriod: string;
};

const numStr = (n: number) => (n ? String(n) : "");

const empty: CForm = {
  name: "",
  email: "",
  phone: "",
  jobId: null,
  recruiterId: null,
  stage: "sourced",
  source: "LinkedIn",
  location: "",
  expYears: "",
  rating: "",
  currentCtc: "",
  expectedCtc: "",
  noticePeriod: "",
  tags: [],
  gender: "",
  currentDesignation: "",
  currentCompany: "",
  graduation: "",
  postGraduation: "",
  birthDate: "",
  maritalStatus: "",
  altEmail: "",
  altPhone: "",
  function: "",
  industry: "",
  resumeUrl: "",
  custom: {},
};

export function CandidateFormModal({
  open,
  candidate,
  team,
  onClose,
}: {
  open: boolean;
  candidate: CandidateRow | null;
  team: ProfileRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const { openDrawer } = useShell();
  const [f, setF] = useState<CForm>(empty);
  const [tagsText, setTagsText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [dup, setDup] = useState<DuplicateMatch | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldRow[]>([]);

  const checkDup = (email: string, phone: string) => {
    findDuplicateCandidate(email, phone, candidate?.id).then(setDup);
  };

  const onResume = (file: File) => {
    setParsing(true);
    const fd = new FormData();
    fd.append("file", file);
    parseResume(fd).then((res) => {
      setParsing(false);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Could not parse the resume");
        return;
      }
      const d = res.data;
      const keep = (v: string, cur: string) => v || cur;
      const num = (v: number, cur: string) => (v ? String(v) : cur);
      setF((s) => ({
        ...s,
        name: keep(d.name, s.name),
        email: keep(d.email, s.email),
        phone: keep(d.phone, s.phone),
        altEmail: keep(d.altEmail, s.altEmail),
        altPhone: keep(d.altPhone, s.altPhone),
        location: keep(d.location, s.location),
        expYears: num(d.expYears, s.expYears),
        currentCtc: num(d.currentCtc, s.currentCtc),
        expectedCtc: num(d.expectedCtc, s.expectedCtc),
        noticePeriod: num(d.noticePeriod, s.noticePeriod),
        currentDesignation: keep(d.currentDesignation, s.currentDesignation),
        currentCompany: keep(d.currentCompany, s.currentCompany),
        gender: keep(d.gender, s.gender),
        graduation: keep(d.graduation, s.graduation),
        postGraduation: keep(d.postGraduation, s.postGraduation),
        function: keep(d.function, s.function),
        industry: keep(d.industry, s.industry),
        maritalStatus: keep(d.maritalStatus, s.maritalStatus),
        birthDate: keep(d.birthDate, s.birthDate),
        resumeUrl: res.resumeUrl || s.resumeUrl,
      }));
      if (d.skills.length) setTagsText(d.skills.join(", "));
      checkDup(d.email, d.phone);
      toast.success("Resume parsed — review the details and save");
    });
  };

  useEffect(() => {
    if (!open) return;
    setErr(false);
    setDup(null);
    if (candidate) {
      setF({
        name: candidate.name,
        email: candidate.email ?? "",
        phone: candidate.phone ?? "",
        jobId: candidate.job_id,
        recruiterId: candidate.recruiter_id,
        stage: candidate.stage,
        source: candidate.source ?? "LinkedIn",
        location: candidate.location ?? "",
        expYears: numStr(candidate.exp_years),
        rating: numStr(candidate.rating),
        currentCtc: numStr(candidate.current_ctc_lpa),
        expectedCtc: numStr(candidate.expected_ctc_lpa),
        noticePeriod: numStr(candidate.notice_period_days),
        tags: candidate.tags,
        gender: candidate.gender,
        currentDesignation: candidate.current_designation,
        currentCompany: candidate.current_company,
        graduation: candidate.graduation,
        postGraduation: candidate.post_graduation,
        birthDate: candidate.birth_date ?? "",
        maritalStatus: candidate.marital_status,
        altEmail: candidate.alt_email,
        altPhone: candidate.alt_phone,
        function: candidate.function,
        industry: candidate.industry,
        resumeUrl: candidate.resume_url,
        custom: (candidate.custom as CustomValues) ?? {},
      });
      setTagsText(candidate.tags.join(", "));
    } else {
      setF({ ...empty, recruiterId: team[0]?.id ?? null });
      setTagsText("");
    }
    (async () => {
      const sb = createClient();
      const [{ data: jobRows }, { data: cfRows }] = await Promise.all([
        sb.from("jobs").select("id,title").order("title"),
        sb
          .from("custom_fields")
          .select("*")
          .eq("module", "candidate")
          .eq("active", true)
          .order("sort"),
      ]);
      setJobs(jobRows ?? []);
      setCustomFields((cfRows ?? []) as CustomFieldRow[]);
    })();
  }, [open, candidate, team]);

  if (!open) return null;
  const set = <K extends keyof CForm>(k: K, v: CForm[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.name.trim()) {
      setErr(true);
      return;
    }
    const payload: CandidateForm = {
      ...f,
      expYears: parseFloat(f.expYears) || 0,
      rating: parseFloat(f.rating) || 0,
      currentCtc: parseFloat(f.currentCtc) || 0,
      expectedCtc: parseFloat(f.expectedCtc) || 0,
      noticePeriod: parseInt(f.noticePeriod) || 0,
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    start(async () => {
      const res = candidate
        ? await updateCandidate(candidate.id, payload)
        : await createCandidate(payload);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        onClose();
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein"
    >
      <datalist id="india-cities-cand">
        {INDIAN_CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[620px] overflow-y-auto rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
      >
        <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[22px_24px_16px]">
          <div>
            <div className="text-[18px] font-extrabold">
              {candidate ? "Edit Candidate" : "Add Candidate"}
            </div>
            <div className="text-[12.5px] font-medium text-[#8a94a6]">
              {candidate ? "Update candidate details" : "Add someone to the pipeline"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-[22px_24px]">
          {!candidate && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-[12px] border border-dashed border-[#c3d4f0] bg-[#f6f9ff] p-4">
              <div className="min-w-0">
                <div className="text-[13px] font-extrabold text-[#16203a]">
                  Attach Resume → Auto-fill
                </div>
                <div className="text-[11.5px] font-medium text-[#8a94a6]">
                  Upload a PDF or Word file — AI reads it and fills the form below.
                </div>
              </div>
              <label
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold text-white ${parsing ? "bg-[#9bbcef]" : "bg-[#2a6fdb] hover:bg-[#1f5bc0]"}`}
              >
                {parsing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileUp size={15} />
                )}
                {parsing ? "Parsing…" : "Upload Resume"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  disabled={parsing}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onResume(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
          {dup && (
            <div className="mb-4 flex items-center gap-3 rounded-[11px] border border-[#f3d9a6] bg-[#fff8ec] p-[12px_14px]">
              <AlertTriangle size={18} className="shrink-0 text-[#b27400]" />
              <div className="flex-1 text-[12.5px] font-semibold text-[#7a5b14]">
                Possible duplicate — <b>{dup.name}</b> is already in your database
                {" "}(stage: {stageFromSlug(dup.stage)}), matched by {dup.via}.
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openDrawer(dup.id);
                }}
                className="shrink-0 rounded-lg bg-[#b27400] px-3 py-1.5 text-[11.5px] font-bold text-white hover:brightness-110"
              >
                View existing
              </button>
            </div>
          )}
          <label className={labelCls}>
            Full Name <span className="text-[#ef4444]">*</span>
          </label>
          <input
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Priya Menon"
            className={fieldCls}
            style={err ? { borderColor: "#ef4444" } : undefined}
          />
          {err && (
            <div className="mt-1.5 text-[11.5px] font-semibold text-[#ef4444]">
              Please enter a name.
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <Field label="Email">
              <input value={f.email} onChange={(e) => set("email", e.target.value)} onBlur={(e) => checkDup(e.target.value, f.phone)} className={fieldCls} placeholder="name@email.com" />
            </Field>
            <Field label="Phone">
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} onBlur={(e) => checkDup(f.email, e.target.value)} className={fieldCls} placeholder="+91…" />
            </Field>
            <Field label="Role / Job">
              <select value={f.jobId ?? ""} onChange={(e) => set("jobId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select role —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Recruiter">
              <select value={f.recruiterId ?? ""} onChange={(e) => set("recruiterId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Unassigned —</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Stage">
              <select value={stageToSlug(STAGES.find((s) => s.slug === f.stage)?.key ?? "Sourced")} onChange={(e) => set("stage", e.target.value as CandidateStage)} className={`${fieldCls} cursor-pointer`}>
                {STAGES.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.key}</option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select value={f.source} onChange={(e) => set("source", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input list="india-cities-cand" value={f.location} onChange={(e) => set("location", e.target.value)} className={fieldCls} placeholder="Type any city…" />
            </Field>
            <Field label="Experience (years)">
              <input inputMode="decimal" value={f.expYears} onChange={(e) => set("expYears", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 5" />
            </Field>
            <Field label="Rating (0–5)">
              <input inputMode="decimal" value={f.rating} onChange={(e) => set("rating", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 4.5" />
            </Field>
            <Field label="Notice Period (days)">
              <input inputMode="numeric" value={f.noticePeriod} onChange={(e) => set("noticePeriod", e.target.value.replace(/[^0-9]/g, ""))} className={fieldCls} placeholder="e.g. 30" />
            </Field>
            <Field label="Current CTC (₹ LPA)">
              <input inputMode="decimal" value={f.currentCtc} onChange={(e) => set("currentCtc", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 5" />
            </Field>
            <Field label="Expected CTC (₹ LPA)">
              <input inputMode="decimal" value={f.expectedCtc} onChange={(e) => set("expectedCtc", e.target.value.replace(/[^0-9.]/g, ""))} className={fieldCls} placeholder="e.g. 7" />
            </Field>
          </div>

          <div className="mt-5 mb-3 border-b border-[#eef1f6] pb-1.5 text-[13px] font-extrabold text-[#16203a]">
            Profile Details
          </div>
          <div className="grid grid-cols-3 gap-3.5">
            <Field label="Gender">
              <select value={f.gender} onChange={(e) => set("gender", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Marital Status">
              <select value={f.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {MARITAL_STATUSES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Birth Date">
              <input type="date" value={f.birthDate} onChange={(e) => set("birthDate", e.target.value)} className={fieldCls} />
            </Field>
            <Field label="Current Designation">
              <input value={f.currentDesignation} onChange={(e) => set("currentDesignation", e.target.value)} className={fieldCls} placeholder="e.g. Senior Engineer" />
            </Field>
            <Field label="Current Company">
              <input value={f.currentCompany} onChange={(e) => set("currentCompany", e.target.value)} className={fieldCls} placeholder="Current employer" />
            </Field>
            <Field label="Function">
              <select value={f.function} onChange={(e) => set("function", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {FUNCTIONAL_AREAS.map((a) => <option key={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Graduation">
              <select value={f.graduation} onChange={(e) => set("graduation", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {QUALIFICATIONS.map((q) => <option key={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Post Graduation">
              <select value={f.postGraduation} onChange={(e) => set("postGraduation", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {QUALIFICATIONS.map((q) => <option key={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Industry">
              <select value={f.industry} onChange={(e) => set("industry", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                <option value="">— Select —</option>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Alternate Email">
              <input value={f.altEmail} onChange={(e) => set("altEmail", e.target.value)} className={fieldCls} placeholder="alt@email.com" />
            </Field>
            <Field label="Alternate Phone">
              <input value={f.altPhone} onChange={(e) => set("altPhone", e.target.value)} className={fieldCls} placeholder="+91…" />
            </Field>
          </div>

          {customFields.length > 0 && (
            <>
              <div className="mt-5 mb-3 border-b border-[#eef1f6] pb-1.5 text-[13px] font-extrabold text-[#16203a]">
                Additional Details
              </div>
              <div className="grid grid-cols-3 gap-3.5">
                {customFields.map((cf) => {
                  const val = f.custom?.[cf.field_key] ?? "";
                  const setCustom = (v: string | number) =>
                    setF((s) => ({ ...s, custom: { ...s.custom, [cf.field_key]: v } }));
                  return (
                    <Field key={cf.id} label={cf.label}>
                      {cf.type === "select" ? (
                        <select value={String(val)} onChange={(e) => setCustom(e.target.value)} className={`${fieldCls} cursor-pointer`}>
                          <option value="">— Select —</option>
                          {cf.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : cf.type === "number" ? (
                        <input
                          inputMode="decimal"
                          value={String(val)}
                          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.-]/g, ""))}
                          className={fieldCls}
                        />
                      ) : (
                        <input value={String(val)} onChange={(e) => setCustom(e.target.value)} className={fieldCls} />
                      )}
                    </Field>
                  );
                })}
              </div>
            </>
          )}

          <label className={`${labelCls} mt-4`}>Keywords / Skills (comma-separated)</label>
          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={fieldCls} placeholder="React, TypeScript, Node" />
        </div>

        <div className="flex gap-2.5 border-t border-[#f0f3f8] p-[16px_24px]">
          <button onClick={onClose} className="flex-1 rounded-[11px] border border-[#e6eaf1] py-3 text-[13.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">
            Cancel
          </button>
          <button onClick={submit} disabled={pending} className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60">
            {candidate ? "Save Changes" : "Add Candidate"}
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
