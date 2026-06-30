"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  stageToSlug,
  stageFromSlug,
  nextStage,
  type StageKey,
} from "@/lib/domain";
import type {
  AppSettingsRow,
  CandidateStage,
  EmploymentType,
  InterviewTypeEnum,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string };

function refresh() {
  revalidatePath("/", "layout");
}

async function setStage(id: string, to: StageKey): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("candidates")
    .update({ stage: stageToSlug(to) as CandidateStage })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function moveCandidateStage(
  id: string,
  toSlug: string,
): Promise<Result> {
  const to = stageFromSlug(toSlug);
  const res = await setStage(id, to);
  return res.ok ? { ...res, message: `Moved to ${to}` } : res;
}

export async function advanceCandidate(id: string): Promise<Result> {
  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("stage,name")
    .eq("id", id)
    .single();
  if (!data) return { ok: false, error: "Candidate not found" };
  const next = nextStage(stageFromSlug(data.stage));
  if (!next) return { ok: false, error: "Already at the final stage" };
  const res = await setStage(id, next);
  return res.ok ? { ...res, message: `${data.name} advanced to ${next}` } : res;
}

export async function rejectCandidate(id: string): Promise<Result> {
  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("name")
    .eq("id", id)
    .single();
  const res = await setStage(id, "Not Joined");
  return res.ok
    ? { ...res, message: `${data?.name ?? "Candidate"} marked as Not Joined` }
    : res;
}

export async function acceptOffer(id: string): Promise<Result> {
  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("stage,name")
    .eq("id", id)
    .single();
  if (!data) return { ok: false, error: "Candidate not found" };
  const current = stageFromSlug(data.stage);
  const to: StageKey = current === "Offered" ? "Offer Accepted" : "Joined";
  const res = await setStage(id, to);
  return res.ok ? { ...res, message: `${data.name} → ${to}` } : res;
}

export async function advanceTalent(id: string): Promise<Result> {
  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("name")
    .eq("id", id)
    .single();
  const res = await setStage(id, "Screening");
  return res.ok
    ? { ...res, message: `${data?.name ?? "Candidate"} moved to Screening` }
    : res;
}

export type ReqForm = {
  title: string;
  designation: string;
  dept: string;
  location: string;
  type: EmploymentType;
  openings: number;
  targetDate: string;
  referenceCode: string;
  clientId: string | null;
  recruiterId: string | null;
  interviewerHr: string;
  interviewVenue: string;
  remoteWork: boolean;
  expMin: number;
  expMax: number;
  functionalArea: string;
  industry: string;
  qualification: string;
  keywords: string;
  minCtc: number;
  maxCtc: number;
  hideSalary: boolean;
  description: string;
  profileCriteria: string;
  benefits: string;
  walkIn: boolean;
  telephonic: boolean;
  status?: "open" | "hot" | "closed";
};

function jobPayload(form: ReqForm) {
  return {
    title: form.title.trim(),
    designation: form.designation,
    dept: form.dept,
    location: form.location,
    type: form.type,
    openings: form.openings || 1,
    target_date: form.targetDate || null,
    reference_code: form.referenceCode,
    client_id: form.clientId,
    recruiter_id: form.recruiterId,
    interviewer_hr: form.interviewerHr,
    interview_venue: form.interviewVenue,
    remote_work: form.remoteWork,
    exp_min: form.expMin || 0,
    exp_max: form.expMax || 0,
    functional_area: form.functionalArea,
    industry: form.industry,
    qualification: form.qualification,
    keywords: form.keywords,
    min_ctc_lpa: form.minCtc || 0,
    max_ctc_lpa: form.maxCtc || 0,
    hide_salary: form.hideSalary,
    description: form.description,
    profile_criteria: form.profileCriteria,
    benefits: form.benefits,
    walk_in: form.walkIn,
    telephonic: form.telephonic,
    status: form.status ?? "open",
  };
}

export async function createRequisition(form: ReqForm): Promise<Result> {
  if (!form.title.trim()) return { ok: false, error: "Job title is required" };
  const sb = await createClient();
  const { error } = await sb.from("jobs").insert({
    ...jobPayload(form),
    posted_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Requisition "${form.title.trim()}" created` };
}

export async function updateRequisition(
  id: string,
  form: ReqForm,
): Promise<Result> {
  if (!form.title.trim()) return { ok: false, error: "Job title is required" };
  const sb = await createClient();
  const { error } = await sb.from("jobs").update(jobPayload(form)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `"${form.title.trim()}" updated` };
}

export async function deleteJob(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("jobs").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Requisition deleted" };
}

export type CandidateForm = {
  name: string;
  email: string;
  phone: string;
  jobId: string | null;
  recruiterId: string | null;
  stage: CandidateStage;
  source: string;
  location: string;
  expYears: number;
  rating: number;
  currentCtc: number;
  expectedCtc: number;
  noticePeriod: number;
  tags: string[];
  gender: string;
  currentDesignation: string;
  currentCompany: string;
  graduation: string;
  postGraduation: string;
  birthDate: string;
  maritalStatus: string;
  altEmail: string;
  altPhone: string;
  function: string;
  industry: string;
  resumeUrl: string;
};

function candidatePayload(form: CandidateForm) {
  return {
    name: form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    job_id: form.jobId,
    recruiter_id: form.recruiterId,
    stage: form.stage,
    source: form.source || null,
    location: form.location || null,
    exp_years: form.expYears || 0,
    rating: form.rating || 0,
    current_ctc_lpa: form.currentCtc || 0,
    expected_ctc_lpa: form.expectedCtc || 0,
    salary_lpa: form.expectedCtc || 0,
    notice_period_days: form.noticePeriod || 0,
    tags: form.tags,
    gender: form.gender,
    current_designation: form.currentDesignation,
    current_company: form.currentCompany,
    graduation: form.graduation,
    post_graduation: form.postGraduation,
    birth_date: form.birthDate || null,
    marital_status: form.maritalStatus,
    alt_email: form.altEmail,
    alt_phone: form.altPhone,
    function: form.function,
    industry: form.industry,
    resume_url: form.resumeUrl,
  };
}

export async function createCandidate(form: CandidateForm): Promise<Result> {
  if (!form.name.trim()) return { ok: false, error: "Candidate name is required" };
  const sb = await createClient();
  const { error } = await sb.from("candidates").insert(candidatePayload(form));
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `${form.name.trim()} added` };
}

export async function updateCandidate(
  id: string,
  form: CandidateForm,
): Promise<Result> {
  if (!form.name.trim()) return { ok: false, error: "Candidate name is required" };
  const sb = await createClient();
  const { error } = await sb
    .from("candidates")
    .update(candidatePayload(form))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `${form.name.trim()} updated` };
}

// Duplicate detection — matches an existing candidate by email or phone
// (across primary + alternate), with phone normalized to its last 10 digits so
// "+91 98765 43210" and "9876543210" match. Returns the existing record or null.
export type DuplicateMatch = {
  id: string;
  name: string;
  stage: CandidateStage;
  via: "email" | "phone";
};

export async function findDuplicateCandidate(
  email: string,
  phone: string,
  excludeId?: string,
): Promise<DuplicateMatch | null> {
  const e = email.trim().toLowerCase();
  const p = phone.replace(/\D/g, "").slice(-10);
  if (!e && p.length < 7) return null;

  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("id,name,stage,email,phone,alt_email,alt_phone");
  if (!data) return null;

  for (const c of data) {
    if (excludeId && c.id === excludeId) continue;
    if (e) {
      const emails = [c.email, c.alt_email]
        .filter(Boolean)
        .map((x) => x!.trim().toLowerCase());
      if (emails.includes(e)) return { id: c.id, name: c.name, stage: c.stage, via: "email" };
    }
    if (p.length >= 7) {
      const phones = [c.phone, c.alt_phone]
        .filter(Boolean)
        .map((x) => x!.replace(/\D/g, "").slice(-10));
      if (phones.includes(p)) return { id: c.id, name: c.name, stage: c.stage, via: "phone" };
    }
  }
  return null;
}

export async function deleteCandidate(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("candidates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Candidate deleted" };
}

// ---- clients (admin only, enforced by RLS) ----
export type ClientForm = {
  name: string;
  status: string;
  city: string;
  referenceCode: string;
  rating: string;
  industry: string;
  contactNumber: string;
  contactEmail: string;
  keyAccountManagerId: string | null;
  transportation: boolean;
  canteen: boolean;
  website: string;
  linkedinUrl: string;
  address: string;
  profile: string;
  remarks: string;
};

export async function saveClient(
  id: string | null,
  form: ClientForm,
): Promise<Result> {
  if (!form.name.trim()) return { ok: false, error: "Client name is required" };
  const sb = await createClient();
  const payload = {
    name: form.name.trim(),
    status: form.status || "Active",
    city: form.city,
    reference_code: form.referenceCode,
    rating: form.rating,
    industry: form.industry,
    contact_number: form.contactNumber,
    contact_email: form.contactEmail.trim() || null,
    key_account_manager_id: form.keyAccountManagerId,
    transportation: form.transportation,
    canteen: form.canteen,
    website: form.website,
    linkedin_url: form.linkedinUrl,
    address: form.address,
    profile: form.profile,
    remarks: form.remarks,
  };
  const { error } = id
    ? await sb.from("clients").update(payload).eq("id", id)
    : await sb.from("clients").insert(payload);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: id ? "Client updated" : `${form.name.trim()} added` };
}

export async function deleteClientRecord(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("clients").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Client deleted" };
}

export type SchedForm = {
  candidateId: string;
  date: string;
  time: string;
  type: InterviewTypeEnum;
  interviewerId: string | null;
};

export async function scheduleInterview(form: SchedForm): Promise<Result> {
  if (!form.candidateId || !form.date || !form.time)
    return { ok: false, error: "Candidate, date and time are required" };
  const sb = await createClient();
  const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { error } = await sb.from("interviews").insert({
    candidate_id: form.candidateId,
    scheduled_at,
    type: form.type,
    interviewer_id: form.interviewerId,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Interview scheduled" };
}

export async function setUserActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: active ? "Recruiter activated" : "Recruiter deactivated" };
}

export async function addCandidateNote(
  candidateId: string,
  body: string,
): Promise<Result> {
  if (!body.trim()) return { ok: false, error: "Note is empty" };
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { error } = await sb.from("candidate_notes").insert({
    candidate_id: candidateId,
    author_id: user?.id ?? null,
    body: body.trim(),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Note added" };
}

export async function deleteCandidateNote(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("candidate_notes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function updateSetting(
  key: "email_notif" | "auto_reject" | "client_portal" | "two_factor",
  value: boolean,
): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("app_settings")
    .update({ [key]: value } as unknown as Partial<AppSettingsRow>)
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
