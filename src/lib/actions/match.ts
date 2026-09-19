"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data";
import { stripHtml } from "@/lib/rich-text";
import type { CandidateRow, TalentBankRow } from "@/lib/database.types";

export type CandidateMatch = {
  source: "pipeline" | "bank";
  id: string;
  name: string;
  skills: string[];
  designation: string;
  expYears: number;
  rating: number;
  currentJobTitle: string; // pipeline: where they sit today; bank: "Talent Bank"
  stageName: string; // pipeline: stage; bank: the folder/category
  onHold: boolean;
  score: number; // # of distinct job terms found
  matched: string[]; // which terms matched (for chips)
};

// Generic role words carry no signal (everyone is an "engineer"), so they're
// excluded from the match terms — matching is driven by real skills/keywords.
const STOP = new Set([
  "the", "and", "for", "with", "of", "in", "to", "a", "an", "on", "or", "at", "as",
  "sr", "senior", "jr", "junior", "lead", "associate", "engineer", "developer",
  "manager", "executive", "consultant", "specialist", "officer", "years", "year",
  "exp", "experience", "requirement", "requirements", "job", "role", "we", "you",
]);

function jobTerms(job: {
  title: string;
  designation: string;
  keywords: string;
  functional_area: string;
}): string[] {
  const terms = new Set<string>();
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t.length >= 2 && !STOP.has(t)) terms.add(t);
  };
  for (const k of (job.keywords || "").split(/[,\n;|/]+/)) add(k);
  for (const w of (job.title || "").split(/[\s,()/]+/)) add(w);
  for (const w of (job.designation || "").split(/[\s,()/]+/)) add(w);
  if (job.functional_area) add(job.functional_area);
  return [...terms];
}

const scoreAgainst = (terms: string[], hayParts: (string | null | undefined)[]) => {
  const hay = hayParts.filter(Boolean).join(" • ").toLowerCase();
  return terms.filter((t) => hay.includes(t));
};

// Rank candidates (pipeline) AND the Talent Bank by how many of the opening's
// skill terms appear in each résumé/profile. Pure keyword overlap — no AI — so
// it stays instant across thousands of resumes.
export async function suggestMatchesForJob(jobId: string): Promise<{
  ok: boolean;
  error?: string;
  jobTitle?: string;
  termCount?: number;
  scanned?: number;
  matches?: CandidateMatch[];
}> {
  const { ws } = await loadWorkspace();
  const job = ws.jobs.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: "Opening not found." };

  const terms = jobTerms({
    title: job.title,
    designation: job.designation,
    keywords: job.keywords,
    functional_area: job.functional_area,
  });
  // Fall back to JD text only if there are no keywords/title terms at all.
  if (!terms.length) {
    for (const w of stripHtml(job.description || "").split(/[\s,()/]+/).slice(0, 60)) {
      const t = w.trim().toLowerCase();
      if (t.length >= 3 && !STOP.has(t)) terms.push(t);
    }
  }
  if (!terms.length)
    return { ok: false, error: "This opening has no keywords/skills to match on — add keywords or a JD to the job first." };

  // Pipeline candidates (not already on this job, not already hired).
  const pipeline: CandidateMatch[] = ws.candidates
    .filter((c) => c.job_id !== jobId && c.stageOutcome !== "won")
    .map((c) => ({ c, matched: scoreAgainst(terms, [...(c.tags || []), c.current_designation, c.current_company, c.function, c.industry, c.jobTitle]) }))
    .filter((r) => r.matched.length > 0)
    .map(({ c, matched }) => ({
      source: "pipeline" as const,
      id: c.id,
      name: c.name,
      skills: c.tags || [],
      designation: c.current_designation || "",
      expYears: c.exp_years || 0,
      rating: c.rating || 0,
      currentJobTitle: c.jobTitle || "—",
      stageName: c.stageName,
      onHold: !!c.on_hold,
      score: matched.length,
      matched,
    }));

  // Talent Bank — page through ALL rows (PostgREST caps a plain select at 1000).
  const sb = await createClient();
  const bankRows: TalentBankRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("talent_bank")
      .select("id,name,skills,current_designation,current_company,exp_years,category,resume_url")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    bankRows.push(...(data as TalentBankRow[]));
    if (data.length < PAGE) break;
  }
  const bank: CandidateMatch[] = bankRows
    .map((b) => ({ b, matched: scoreAgainst(terms, [...(b.skills || []), b.current_designation, b.current_company, b.category]) }))
    .filter((r) => r.matched.length > 0)
    .map(({ b, matched }) => ({
      source: "bank" as const,
      id: b.id,
      name: b.name,
      skills: b.skills || [],
      designation: b.current_designation || "",
      expYears: b.exp_years || 0,
      rating: 0,
      currentJobTitle: "Talent Bank",
      stageName: b.category || "Bank",
      onHold: false,
      score: matched.length,
      matched,
    }));

  const matches = [...pipeline, ...bank]
    .sort((a, b) => b.score - a.score || b.rating - a.rating || b.expYears - a.expYears)
    .slice(0, 60);

  return {
    ok: true,
    jobTitle: job.title,
    termCount: terms.length,
    scanned: ws.candidates.length + bankRows.length,
    matches,
  };
}

// Pull a matched PIPELINE candidate onto this opening (fresh at first stage).
export async function assignCandidateToJob(
  candidateId: string,
  jobId: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const sb = await createClient();
  const { data: job } = await sb.from("jobs").select("title,recruiter_id").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Opening not found." };
  const { data: cand } = await sb.from("candidates").select("name,recruiter_id").eq("id", candidateId).maybeSingle();
  const patch: Record<string, unknown> = { job_id: jobId, stage: "sourced" };
  if (cand && !cand.recruiter_id && job.recruiter_id) patch.recruiter_id = job.recruiter_id;
  const { error } = await sb.from("candidates").update(patch as unknown as Partial<CandidateRow>).eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  await sb.from("candidate_notes").insert({ candidate_id: candidateId, author_id: null, body: `Matched & moved to opening: ${job.title}` });
  revalidatePath("/", "layout");
  return { ok: true, message: `${cand?.name ?? "Candidate"} added to ${job.title}` };
}

// Bring a Talent Bank résumé into an opening: creates a pipeline candidate from
// the bank row (or reuses an existing candidate with the same email). The bank
// row stays in the bank as the master copy.
export async function assignBankResumeToJob(
  bankId: string,
  jobId: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const sb = await createClient();
  const [{ data: job }, { data: b }] = await Promise.all([
    sb.from("jobs").select("title,recruiter_id").eq("id", jobId).maybeSingle(),
    sb.from("talent_bank").select("*").eq("id", bankId).maybeSingle(),
  ]);
  if (!job) return { ok: false, error: "Opening not found." };
  if (!b) return { ok: false, error: "Résumé not found in the bank." };
  const bank = b as TalentBankRow;

  // Reuse an existing candidate with the same email instead of duplicating.
  if (bank.email) {
    const { data: existing } = await sb
      .from("candidates")
      .select("id")
      .eq("email", bank.email)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await sb
        .from("candidates")
        .update({ job_id: jobId, stage: "sourced" } as unknown as Partial<CandidateRow>)
        .eq("id", existing.id);
      if (error) return { ok: false, error: error.message };
      revalidatePath("/", "layout");
      return { ok: true, message: `${bank.name} (existing profile) moved to ${job.title}` };
    }
  }

  const payload: Record<string, unknown> = {
    name: bank.name,
    email: bank.email,
    phone: bank.phone,
    job_id: jobId,
    recruiter_id: job.recruiter_id,
    stage: "sourced",
    source: "Talent Bank",
    location: bank.location,
    exp_years: bank.exp_years || 0,
    current_designation: bank.current_designation || "",
    current_company: bank.current_company || "",
    tags: bank.skills || [],
    resume_url: bank.resume_url || "",
  };
  const { data: created, error } = await sb
    .from("candidates")
    .insert(payload as unknown as Partial<CandidateRow>)
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Could not add the résumé." };
  await sb.from("candidate_notes").insert({ candidate_id: created.id, author_id: null, body: `Sourced from Talent Bank → ${job.title}` });
  revalidatePath("/", "layout");
  return { ok: true, message: `${bank.name} added to ${job.title} from the bank` };
}
