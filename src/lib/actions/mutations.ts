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
  dept: string;
  location: string;
  type: EmploymentType;
  openings: number;
  clientId: string | null;
  recruiterId: string | null;
  description: string;
};

export async function createRequisition(form: ReqForm): Promise<Result> {
  if (!form.title.trim()) return { ok: false, error: "Job title is required" };
  const sb = await createClient();
  const { error } = await sb.from("jobs").insert({
    title: form.title.trim(),
    dept: form.dept,
    location: form.location,
    type: form.type,
    openings: form.openings || 1,
    client_id: form.clientId,
    recruiter_id: form.recruiterId,
    status: "open",
    description: form.description,
    posted_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Requisition "${form.title.trim()}" created` };
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
