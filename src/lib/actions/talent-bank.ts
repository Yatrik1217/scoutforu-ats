"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseResume } from "@/lib/actions/parse-resume";
import { createCandidate } from "@/lib/actions/mutations";
import { categorizeResume } from "@/lib/talent-category";

type Result = { ok: boolean; error?: string; message?: string };

// Parse one dumped resume and file it into the Talent Bank — NOT the pipeline.
// Mirrors the bulk-upload parser but writes to `talent_bank` instead of
// `candidates`, so nothing here ever enters the active candidate flow.
export type DumpResult = {
  status: "added" | "duplicate" | "error";
  name: string;
  category?: string;
  message: string;
  // Present on API-level failures so the uploader can halt the batch (e.g. no
  // credits) instead of retrying every remaining file.
  code?: "billing" | "auth" | "rate_limit" | "overloaded" | "config";
};

export async function dumpResumeToTalentBank(formData: FormData): Promise<DumpResult> {
  const res = await parseResume(formData);
  if (!res.ok || !res.data)
    return { status: "error", name: "", message: res.error ?? "Parse failed", code: res.code };
  const d = res.data;
  if (!d.name.trim()) return { status: "error", name: "", message: "No name found in the resume" };

  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  // De-dupe within the Talent Bank by email or phone.
  const email = (d.email || "").trim().toLowerCase();
  const phone = (d.phone || "").replace(/\D/g, "").slice(-10);
  if (email || phone.length >= 7) {
    const { data: existing } = await sb.from("talent_bank").select("id,email,phone");
    const dup = (existing ?? []).find(
      (t) =>
        (email && (t.email || "").toLowerCase() === email) ||
        (phone.length >= 7 && (t.phone || "").replace(/\D/g, "").slice(-10) === phone),
    );
    if (dup) return { status: "duplicate", name: d.name, message: `${d.name} is already in the Talent Bank` };
  }

  const category = categorizeResume({
    skills: d.skills,
    designation: d.currentDesignation,
    functionalArea: d.function,
  });

  const { error } = await sb.from("talent_bank").insert({
    name: d.name.trim(),
    email: d.email || null,
    phone: d.phone || null,
    exp_years: Math.max(0, Math.round(d.expYears || 0)),
    location: d.location || null,
    current_designation: d.currentDesignation || null,
    current_company: d.currentCompany || null,
    skills: d.skills ?? [],
    category,
    source: "Resume Dump",
    resume_url: res.resumeUrl || null,
    added_by: user?.id ?? null,
  });
  if (error) return { status: "error", name: d.name, message: error.message };
  revalidatePath("/talent-bank");
  return { status: "added", name: d.name, category, message: `Filed under ${category}` };
}

// Promote a Talent Bank entry into a real opening — creates a candidate in the
// pipeline (Sourced) and removes it from the bank.
export async function promoteFromTalentBank(id: string, jobId: string): Promise<Result> {
  if (!jobId) return { ok: false, error: "Pick an opening to add them to." };
  const sb = await createClient();
  const { data: t } = await sb.from("talent_bank").select("*").eq("id", id).maybeSingle();
  if (!t) return { ok: false, error: "Talent record not found." };

  const created = await createCandidate({
    name: t.name,
    email: t.email ?? "",
    phone: t.phone ?? "",
    jobId,
    recruiterId: null,
    stage: "sourced",
    source: "Talent Bank",
    location: t.location ?? "",
    expYears: t.exp_years ?? 0,
    rating: 0,
    currentCtc: 0,
    expectedCtc: 0,
    noticePeriod: 0,
    tags: t.skills ?? [],
    gender: "",
    currentDesignation: t.current_designation ?? "",
    currentCompany: t.current_company ?? "",
    graduation: "",
    postGraduation: "",
    birthDate: "",
    maritalStatus: "",
    altEmail: "",
    altPhone: "",
    function: "",
    industry: "",
    resumeUrl: t.resume_url ?? "",
    custom: {},
  });
  if (!created.ok) return { ok: false, error: created.error ?? "Could not add to the opening." };

  await sb.from("talent_bank").delete().eq("id", id);
  revalidatePath("/talent-bank");
  revalidatePath("/", "layout");
  return { ok: true, message: `${t.name} added to the opening (now in Sourced).` };
}

export async function deleteTalentBank(id: string): Promise<Result> {
  const sb = await createClient();
  const { error } = await sb.from("talent_bank").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/talent-bank");
  return { ok: true, message: "Removed from Talent Bank" };
}
