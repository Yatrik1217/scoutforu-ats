"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data";
import { stripHtml } from "@/lib/rich-text";
import type { CandidateRow } from "@/lib/database.types";

export type CandidateMatch = {
  id: string;
  name: string;
  skills: string[];
  designation: string;
  expYears: number;
  rating: number;
  currentJobTitle: string; // where they sit today ("—" if none)
  stageName: string;
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
  description: string;
}): string[] {
  const terms = new Set<string>();
  const add = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t.length >= 2 && !STOP.has(t)) terms.add(t);
  };
  // Recruiter-entered keywords are the strongest signal — split on separators so
  // multi-word skills stay intact (".net", "entity framework", "azure devops").
  for (const k of (job.keywords || "").split(/[,\n;|/]+/)) add(k);
  for (const w of (job.title || "").split(/[\s,()/]+/)) add(w);
  for (const w of (job.designation || "").split(/[\s,()/]+/)) add(w);
  if (job.functional_area) add(job.functional_area);
  return [...terms];
}

// Rank candidates NOT already on this job by how many of the job's skill terms
// appear in their profile (skills, designation, company, domain, current role).
// Cheap keyword overlap — no AI — so it's free to run across the whole bank.
export async function suggestMatchesForJob(jobId: string): Promise<{
  ok: boolean;
  error?: string;
  jobTitle?: string;
  termCount?: number;
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
    description: stripHtml(job.description || ""),
  });
  if (!terms.length)
    return { ok: false, error: "This opening has no keywords/skills to match on — add keywords or a JD to the job first." };

  const matches: CandidateMatch[] = ws.candidates
    .filter((c) => c.job_id !== jobId && c.stageOutcome !== "won") // not on this job, not already hired
    .map((c) => {
      const hay = [
        ...(c.tags || []),
        c.current_designation,
        c.current_company,
        c.function,
        c.industry,
        c.jobTitle,
      ]
        .filter(Boolean)
        .join(" • ")
        .toLowerCase();
      const matched = terms.filter((t) => hay.includes(t));
      return { c, matched };
    })
    .filter((r) => r.matched.length > 0)
    .sort(
      (a, b) =>
        b.matched.length - a.matched.length ||
        b.c.rating - a.c.rating ||
        b.c.exp_years - a.c.exp_years,
    )
    .slice(0, 40)
    .map(({ c, matched }) => ({
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

  return { ok: true, jobTitle: job.title, termCount: terms.length, matches };
}

// Pull a matched candidate onto this opening (starts them fresh at the first
// pipeline stage). Used from the match list. Their old job link is replaced.
export async function assignCandidateToJob(
  candidateId: string,
  jobId: string,
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const sb = await createClient();
  const { data: job } = await sb.from("jobs").select("title,recruiter_id").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Opening not found." };
  const { data: cand } = await sb.from("candidates").select("name,recruiter_id").eq("id", candidateId).maybeSingle();
  const patch: Record<string, unknown> = { job_id: jobId, stage: "sourced" };
  // If the candidate had no owner, inherit the opening's lead recruiter.
  if (cand && !cand.recruiter_id && job.recruiter_id) patch.recruiter_id = job.recruiter_id;
  const { error } = await sb
    .from("candidates")
    .update(patch as unknown as Partial<CandidateRow>)
    .eq("id", candidateId);
  if (error) return { ok: false, error: error.message };
  await sb.from("candidate_notes").insert({
    candidate_id: candidateId,
    author_id: null,
    body: `Matched & moved to opening: ${job.title}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `${cand?.name ?? "Candidate"} added to ${job.title}` };
}
