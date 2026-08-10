"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendMail, emailConfigured, fromAddress } from "@/lib/email";
import {
  stageToSlug,
  stageFromSlug,
  nextStage,
  type StageKey,
} from "@/lib/domain";
import type {
  AppSettingsRow,
  CandidateStage,
  CustomValues,
  EmploymentType,
  FeedbackRecommendation,
  InterviewTypeEnum,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string };

function refresh() {
  revalidatePath("/", "layout");
}

async function setStage(id: string, to: StageKey): Promise<Result> {
  const sb = await createClient();
  const patch: { stage: CandidateStage; review_status?: "pending" } = {
    stage: stageToSlug(to) as CandidateStage,
  };

  // Internal profile approval: when a plain recruiter submits a candidate to
  // Screening (and approvers are configured), the profile goes to "pending"
  // until an internal approver signs it off for client submission.
  if (to === "Screening") {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (user) {
      const [{ data: me }, { count: approverCount }] = await Promise.all([
        sb.from("profiles").select("role,is_approver").eq("id", user.id).maybeSingle(),
        sb
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_approver", true)
          .eq("active", true),
      ]);
      if ((approverCount ?? 0) > 0 && me && me.role !== "master_admin" && !me.is_approver)
        patch.review_status = "pending";
    }
  }

  const { error } = await sb.from("candidates").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// Internal approver signs off (or sends back) a submitted profile.
export async function reviewCandidate(
  id: string,
  status: "approved" | "rejected",
  note?: string,
): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb
    .from("profiles")
    .select("role,is_approver,name")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || (me.role !== "master_admin" && !me.is_approver))
    return { ok: false, error: "Only internal approvers can review profiles" };

  const { data: cand } = await sb.from("candidates").select("name").eq("id", id).single();
  const { error } = await sb
    .from("candidates")
    .update({ review_status: status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const verdict =
    status === "approved" ? "Profile approved for client submission" : "Profile sent back";
  await sb.from("candidate_notes").insert({
    candidate_id: id,
    author_id: user.id,
    body: `${verdict}${note?.trim() ? ` — ${note.trim()}` : ""}`,
  });
  refresh();
  return {
    ok: true,
    message: `${cand?.name ?? "Candidate"}: ${status === "approved" ? "approved ✓" : "sent back"}`,
  };
}

// Automation: if an enabled stage_email_rule exists for the new stage, auto-send
// its template to the candidate. Best-effort — never blocks the stage move.
async function sendStageAutoEmail(
  sb: Awaited<ReturnType<typeof createClient>>,
  candidateId: string,
  toSlug: string,
): Promise<void> {
  try {
    const { data: rule } = await sb
      .from("stage_email_rules")
      .select("template_id,enabled")
      .eq("stage", toSlug)
      .maybeSingle();
    if (!rule || !rule.enabled || !rule.template_id || !emailConfigured()) return;
    const [{ data: tpl }, { data: cand }] = await Promise.all([
      sb.from("email_templates").select("subject,body").eq("id", rule.template_id).maybeSingle(),
      sb.from("candidates").select("name,email").eq("id", candidateId).maybeSingle(),
    ]);
    if (!tpl || !cand?.email) return;
    const first = (cand.name || "").trim().split(/\s+/)[0] || "";
    const fill = (t: string) =>
      (t || "")
        .replace(/\{\{\s*name\s*\}\}/gi, cand.name || "")
        .replace(/\{\{\s*first_name\s*\}\}/gi, first);
    const esc = (s: string) =>
      String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
    const bodyFilled = fill(tpl.body);
    await sendMail({
      to: cand.email,
      subject: fill(tpl.subject) || "An update on your application",
      html: `<div style="font:14px/1.65 Arial,Helvetica,sans-serif;color:#1a1a1a;white-space:pre-wrap">${esc(bodyFilled)}</div>`,
      text: bodyFilled,
    });
    const {
      data: { user },
    } = await sb.auth.getUser();
    await sb.from("candidate_notes").insert({
      candidate_id: candidateId,
      author_id: user?.id ?? null,
      body: `📤 Auto-email sent (stage → ${toSlug})`,
    });
  } catch {
    /* best-effort; a failed auto-email must never block the move */
  }
}

export async function moveCandidateStage(
  id: string,
  toSlug: string,
): Promise<Result> {
  const to = stageFromSlug(toSlug);
  const res = await setStage(id, to);
  if (res.ok) {
    const sb = await createClient();
    await sendStageAutoEmail(sb, id, toSlug);
  }
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

export async function rejectCandidate(id: string, reason?: string): Promise<Result> {
  const sb = await createClient();
  const { data } = await sb
    .from("candidates")
    .select("name")
    .eq("id", id)
    .single();
  const cleanReason = (reason ?? "").trim();
  if (cleanReason) {
    await sb.from("candidates").update({ reject_reason: cleanReason }).eq("id", id);
    const {
      data: { user },
    } = await sb.auth.getUser();
    await sb.from("candidate_notes").insert({
      candidate_id: id,
      author_id: user?.id ?? null,
      body: `Rejected — reason: ${cleanReason}`,
    });
  }
  const res = await setStage(id, "Not Joined");
  return res.ok
    ? {
        ...res,
        message: `${data?.name ?? "Candidate"} marked as Not Joined${cleanReason ? ` (${cleanReason})` : ""}`,
      }
    : res;
}

export async function addDisqualifyReason(label: string): Promise<Result> {
  const clean = label.trim();
  if (!clean) return { ok: false, error: "Reason is empty" };
  const sb = await createClient();
  const { error } = await sb.from("disqualify_reasons").insert({ label: clean, sort: 100 });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Reason added" };
}

export async function setDisqualifyReasonActive(id: string, active: boolean): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("disqualify_reasons").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteDisqualifyReason(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("disqualify_reasons").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Reason removed" };
}

export async function updateOrganization(patch: {
  name: string;
  tagline: string;
  logo_url: string;
  address: string;
  city: string;
  gst: string;
  phone: string;
  email: string;
  website: string;
}): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("organization")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Organization saved" };
}

export async function addBranch(name: string, city: string): Promise<Result> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Branch name is required" };
  const sb = await createClient();
  const { error } = await sb.from("branches").insert({ name: clean, city: city.trim(), sort: 100 });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Branch added" };
}

export async function setBranchActive(id: string, active: boolean): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("branches").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteBranch(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("branches").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Branch removed" };
}

export async function addCustomField(input: {
  module: "candidate" | "job" | "client";
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
}): Promise<Result> {
  const label = input.label.trim();
  if (!label) return { ok: false, error: "Label is required" };
  const key =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || `field_${Date.now()}`;
  const options =
    input.type === "select"
      ? (input.options ?? []).map((o) => o.trim()).filter(Boolean)
      : [];
  const sb = await createClient();
  const { error } = await sb.from("custom_fields").insert({
    module: input.module,
    label,
    field_key: key,
    type: input.type,
    options,
    sort: 100,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Field added" };
}

export async function setCustomFieldActive(id: string, active: boolean): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("custom_fields").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function deleteCustomField(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("custom_fields").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Field removed" };
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
  // Full set of recruiters assigned to the job (lead + co-recruiters). The lead
  // is recruiterId (kept for "owned by" display); this drives co-recruiting.
  recruiterIds?: string[];
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

// Replace the set of recruiters assigned to a job. The lead (recruiterId) is
// always included. Delete-then-insert keeps it simple and idempotent.
async function syncJobRecruiters(
  sb: Awaited<ReturnType<typeof createClient>>,
  jobId: string,
  form: ReqForm,
) {
  const ids = Array.from(
    new Set([form.recruiterId, ...(form.recruiterIds ?? [])].filter(Boolean)),
  ) as string[];
  await sb.from("job_recruiters").delete().eq("job_id", jobId);
  if (ids.length)
    await sb.from("job_recruiters").insert(ids.map((rid) => ({ job_id: jobId, recruiter_id: rid })));
}

export async function createRequisition(form: ReqForm): Promise<Result> {
  if (!form.title.trim()) return { ok: false, error: "Job title is required" };
  const sb = await createClient();
  // Approval workflow: if any approvers are configured, jobs created by
  // non-admin, non-approver staff start pending until approved.
  let approval: "pending" | "approved" = "approved";
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (user) {
    const [{ data: me }, { count: approverCount }] = await Promise.all([
      sb.from("profiles").select("role,is_approver").eq("id", user.id).maybeSingle(),
      sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_approver", true)
        .eq("active", true),
    ]);
    if (
      (approverCount ?? 0) > 0 &&
      me &&
      me.role !== "master_admin" &&
      !me.is_approver
    )
      approval = "pending";
  }
  const { data: created, error } = await sb
    .from("jobs")
    .insert({
      ...jobPayload(form),
      approval_status: approval,
      posted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Could not create the job" };
  await syncJobRecruiters(sb, created.id, form);
  refresh();
  return {
    ok: true,
    message:
      approval === "pending"
        ? `"${form.title.trim()}" submitted for approval`
        : `Requisition "${form.title.trim()}" created`,
  };
}

export async function setJobApproval(
  id: string,
  status: "approved" | "rejected",
): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb
    .from("profiles")
    .select("role,is_approver")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || (me.role !== "master_admin" && !me.is_approver))
    return { ok: false, error: "Only approvers can approve requisitions" };
  const { error } = await sb.from("jobs").update({ approval_status: status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: status === "approved" ? "Requisition approved" : "Requisition rejected" };
}

export async function setJobPublished(id: string, published: boolean): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (published) {
    // Only approved, open roles can go on the public careers page.
    const { data: job } = await sb
      .from("jobs")
      .select("approval_status,status")
      .eq("id", id)
      .maybeSingle();
    if (!job) return { ok: false, error: "Job not found" };
    if (job.approval_status !== "approved")
      return { ok: false, error: "Job must be approved before publishing" };
    if (job.status !== "open" && job.status !== "hot")
      return { ok: false, error: "Only open jobs can be published" };
  }
  const { error } = await sb
    .from("jobs")
    .update({ published, published_at: published ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    if (/published/.test(error.message) && /column|schema/.test(error.message))
      return { ok: false, error: "Run migration 0021_job_publish.sql in Supabase → SQL Editor first" };
    return { ok: false, error: error.message };
  }
  refresh();
  return { ok: true, message: published ? "Job is live on your careers page" : "Job removed from careers page" };
}

export async function setUserApprover(id: string, isApprover: boolean): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ is_approver: isApprover }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function updateEmailTemplate(
  id: string,
  subject: string,
  body: string,
): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("email_templates")
    .update({ subject, body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Template saved" };
}

export async function updateInvoiceSettings(patch: {
  prefix: string;
  next_number: number;
  gst_percent: number;
  pan: string;
  gstin: string;
  bank_details: string;
  terms: string;
}): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb
    .from("invoice_settings")
    .upsert({ id: true, ...patch, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Invoice settings saved" };
}

// A recruiter may only edit/delete the openings assigned to them; admins any.
// (RLS enforces this at the DB too; this gives a clean message + works even
// before the RLS migration is applied.)
async function canManageJob(
  sb: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<boolean> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return false;
  const { data: me } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role === "master_admin") return true;
  const { data: job } = await sb
    .from("jobs")
    .select("recruiter_id")
    .eq("id", id)
    .maybeSingle();
  return !!job && String(job.recruiter_id) === String(user.id);
}

export async function updateRequisition(
  id: string,
  form: ReqForm,
): Promise<Result> {
  if (!form.title.trim()) return { ok: false, error: "Job title is required" };
  const sb = await createClient();
  if (!(await canManageJob(sb, id)))
    return { ok: false, error: "You can only edit openings assigned to you." };
  const { error } = await sb.from("jobs").update(jobPayload(form)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await syncJobRecruiters(sb, id, form);
  refresh();
  return { ok: true, message: `"${form.title.trim()}" updated` };
}

export async function deleteJob(id: string): Promise<Result> {
  const sb = await createClient();
  // Deleting an opening is destructive — restrict to master admins.
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = user
    ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (me?.role !== "master_admin")
    return { ok: false, error: "Only an admin can delete an opening." };
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
  custom: CustomValues;
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
    custom: form.custom ?? {},
  };
}

export async function createCandidate(form: CandidateForm): Promise<Result> {
  if (!form.name.trim()) return { ok: false, error: "Candidate name is required" };
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = user
    ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  const payload = candidatePayload(form);
  // A recruiter's submitted candidate is owned by them — so it's "theirs" under
  // RLS and shows in their pickers/pipeline. Admins may assign to anyone.
  if (me?.role !== "master_admin" && user) payload.recruiter_id = user.id;
  const { error } = await sb.from("candidates").insert(payload);
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

// Upload a company logo to a public storage bucket and return its URL (admin
// only). Self-provisions the "branding" bucket so no manual setup is needed.
export async function uploadOrgLogo(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: me } = user
    ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  if (me?.role !== "master_admin") return { ok: false, error: "Admins only." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Please choose an image." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Image must be under 2 MB." };

  let svc;
  try {
    svc = createServiceClient();
  } catch {
    return { ok: false, error: "Storage isn't configured on the server." };
  }
  await svc.storage.createBucket("branding", { public: true }).catch(() => {}); // ignore "exists"
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `logo-${Date.now()}.${ext || "png"}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await svc.storage
    .from("branding")
    .upload(path, buf, { contentType: file.type || "image/png", upsert: true });
  if (error) return { ok: false, error: error.message };
  const { data } = svc.storage.from("branding").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

export type SchedForm = {
  candidateId: string;
  date: string;
  time: string;
  type: InterviewTypeEnum;
  interviewerId: string | null;
  location?: string;
  notes?: string;
  sendInvite?: boolean;
};

// Build a calendar invite (.ics) for the interview so the candidate + interviewer
// can add it to their calendar in one tap.
function buildInterviewIcs(opts: {
  uid: string;
  startISO: string;
  minutes: number;
  summary: string;
  description: string;
  location: string;
  organizer: string;
}): string {
  const z = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const end = new Date(new Date(opts.startISO).getTime() + opts.minutes * 60000).toISOString();
  const esc = (s: string) => (s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScoutforU//ATS//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${z(new Date().toISOString())}`,
    `DTSTART:${z(opts.startISO)}`,
    `DTEND:${z(end)}`,
    `SUMMARY:${esc(opts.summary)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    opts.location ? `LOCATION:${esc(opts.location)}` : "",
    opts.organizer ? `ORGANIZER:MAILTO:${opts.organizer}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function scheduleInterview(form: SchedForm): Promise<Result> {
  if (!form.candidateId || !form.date || !form.time)
    return { ok: false, error: "Candidate, date and time are required" };
  const sb = await createClient();
  const scheduled_at = new Date(`${form.date}T${form.time}:00`).toISOString();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { data: row, error } = await sb
    .from("interviews")
    .insert({
      candidate_id: form.candidateId,
      scheduled_at,
      type: form.type,
      interviewer_id: form.interviewerId,
      location: form.location ?? "",
      notes: form.notes ?? "",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Send the invite (email + calendar .ics) to the candidate and interviewer.
  let noteSuffix = "";
  if (form.sendInvite !== false) {
    try {
      const [{ data: cand }, { data: interviewer }] = await Promise.all([
        sb.from("candidates").select("name,email,job_id").eq("id", form.candidateId).maybeSingle(),
        form.interviewerId
          ? sb.from("profiles").select("name,email").eq("id", form.interviewerId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const { data: job } = cand?.job_id
        ? await sb.from("jobs").select("title").eq("id", cand.job_id).maybeSingle()
        : { data: null };
      if (emailConfigured() && cand?.email) {
        const when = new Date(scheduled_at);
        const whenStr = when.toLocaleString("en-IN", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        });
        const typeLabel = { video: "Video", phone: "Phone", onsite: "On-site", practical: "Practical" }[form.type];
        const role = job?.title ? ` for ${job.title}` : "";
        const loc = form.location ? `\nLocation / link: ${form.location}` : "";
        const notes = form.notes ? `\n\nNotes: ${form.notes}` : "";
        const bodyText = `Hi ${cand.name},\n\nYour ${typeLabel} interview${role} is scheduled for:\n${whenStr} (IST)${loc}${notes}\n\nThe calendar invite is attached. See you then!\n\nScoutforU Consultants`;
        const esc = (s: string) =>
          String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
        const ics = buildInterviewIcs({
          uid: `${row.id}@scoutforu`,
          startISO: scheduled_at,
          minutes: 45,
          summary: `Interview — ${cand.name}${role}`,
          description: `${typeLabel} interview${role}.${form.location ? ` ${form.location}` : ""}`,
          location: form.location ?? "",
          organizer: fromAddress(),
        });
        await sendMail({
          to: cand.email,
          cc: interviewer?.email || undefined,
          subject: `Interview scheduled${role} — ${whenStr}`,
          html: `<div style="font:14px/1.65 Arial,Helvetica,sans-serif;color:#1a1a1a;white-space:pre-wrap">${esc(bodyText)}</div>`,
          text: bodyText,
          attachments: [{ filename: "interview.ics", content: Buffer.from(ics), contentType: "text/calendar" }],
        });
        noteSuffix = " · invite emailed";
      } else if (!cand?.email) {
        noteSuffix = " · no email on candidate (invite not sent)";
      }
    } catch (e) {
      noteSuffix = " · invite email failed: " + (e as Error).message;
    }
  }

  refresh();
  return { ok: true, message: "Interview scheduled" + noteSuffix };
}

// Hand a recruiter's live pipeline to someone else (used when she resigns).
// Moves only OPEN work — active candidates (not yet joined/not-joined) and open
// jobs — so her historical hires, placements and commission stay attributed to
// her. Optionally deactivates her in the same step.
export async function reassignRecruiterWork(input: {
  fromId: string;
  toId: string;
  deactivate?: boolean;
}): Promise<Result & { moved?: { candidates: number; jobs: number } }> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin") return { ok: false, error: "Only the Master Admin can do this" };

  const { fromId, toId, deactivate } = input;
  if (!fromId || !toId) return { ok: false, error: "Pick who to hand the work to" };
  if (fromId === toId) return { ok: false, error: "Choose a different person to receive the work" };

  // The receiver must be an active recruiter or the admin — never a client login.
  const { data: target } = await sb.from("profiles").select("id,active,role").eq("id", toId).maybeSingle();
  if (!target || target.active === false || target.role === "client")
    return { ok: false, error: "The receiving user must be an active recruiter or admin" };

  const { data: movedCands, error: cErr } = await sb
    .from("candidates")
    .update({ recruiter_id: toId })
    .eq("recruiter_id", fromId)
    .not("stage", "in", "(joined,not_joined)")
    .select("id");
  if (cErr) return { ok: false, error: cErr.message };

  const { data: movedJobs, error: jErr } = await sb
    .from("jobs")
    .update({ recruiter_id: toId })
    .eq("recruiter_id", fromId)
    .in("status", ["open", "hot"])
    .select("id");
  if (jErr) return { ok: false, error: jErr.message };

  if (deactivate) {
    if (fromId === user.id) return { ok: false, error: "You can't deactivate your own account" };
    const { error: dErr } = await sb.from("profiles").update({ active: false }).eq("id", fromId);
    if (dErr) return { ok: false, error: dErr.message };
  }

  refresh();
  const moved = { candidates: movedCands?.length ?? 0, jobs: movedJobs?.length ?? 0 };
  return {
    ok: true,
    moved,
    message: `Moved ${moved.candidates} candidate${moved.candidates === 1 ? "" : "s"} and ${moved.jobs} job${moved.jobs === 1 ? "" : "s"}${deactivate ? " · recruiter deactivated" : ""}`,
  };
}

export async function setUserActive(
  id: string,
  active: boolean,
): Promise<Result> {
  const sb = await createClient();
  // Only the Master Admin may activate/deactivate accounts.
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "master_admin") return { ok: false, error: "Only the Master Admin can do this" };
  if (id === user.id) return { ok: false, error: "You can't deactivate your own account" };

  // Deactivation only blocks sign-in — it never deletes the recruiter's data.
  // Her candidates, jobs and placements stay owned by her profile and remain
  // fully visible to the admin.
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

export async function addInterviewFeedback(
  candidateId: string,
  rating: number,
  recommendation: FeedbackRecommendation,
  notes: string,
): Promise<Result> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  const { error } = await sb.from("interview_feedback").insert({
    candidate_id: candidateId,
    interviewer_id: user?.id ?? null,
    rating: Math.max(0, Math.min(5, rating)),
    recommendation,
    notes: notes.trim(),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Feedback submitted" };
}

export async function deleteInterviewFeedback(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("interview_feedback").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function regenerateApiToken(): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
}> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  const token =
    "sfu_" +
    crypto.randomUUID().replace(/-/g, "") +
    crypto.randomUUID().replace(/-/g, "");
  const { error } = await sb
    .from("profiles")
    .update({ api_token: token })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, token };
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
