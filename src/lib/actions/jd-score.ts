"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { stripHtml } from "@/lib/rich-text";
import type { JdMatch } from "@/lib/database.types";

type Result = { ok: boolean; error?: string; score?: number; match?: JdMatch };

const SYSTEM = `You are a strict but fair technical recruiter. Score how well a candidate matches a job description, 0-100, weighing: must-have skills present, relevant years of experience, role/domain fit, and seniority. Equivalents and synonyms count (e.g. "Oracle PL/SQL developer" matches a "PL/SQL" JD; "React.js" matches "ReactJS"; "Postgres" matches "PostgreSQL"). Do NOT reward unrelated skills or pad the score. A weak or off-domain resume should score low.

Reply with ONLY a JSON object, no prose, no code fences:
{"score": <integer 0-100>, "matched": [<up to 8 concrete JD requirements the candidate clearly meets>], "missing": [<up to 8 important JD requirements the candidate is missing>], "summary": "<one concise sentence on the overall fit>"}`;

// Score one pipeline candidate against the JD of the job they're submitted to.
// On-demand + cached (stored on candidates.jd_match) so it's only charged once
// per resume until re-scored. Uses claude-haiku-4-5 (~half a rupee per score).
export async function scoreCandidateJd(candidateId: string): Promise<Result> {
  if (!process.env.ANTHROPIC_API_KEY)
    return { ok: false, error: "Resume scoring isn't configured (missing API key)." };

  const sb = await createClient();
  const { data: cand } = await sb
    .from("candidates")
    .select("id,name,job_id,tags,current_designation,current_company,exp_years,function,industry")
    .eq("id", candidateId)
    .maybeSingle();
  if (!cand) return { ok: false, error: "Candidate not found." };
  if (!cand.job_id)
    return { ok: false, error: "This candidate isn't linked to an opening — nothing to score against." };

  const { data: job } = await sb
    .from("jobs")
    .select("title,description")
    .eq("id", cand.job_id)
    .maybeSingle();
  if (!job || !(job.description || "").trim())
    return { ok: false, error: "This opening has no JD yet — add a description to the job first." };

  const profile = [
    `Designation: ${cand.current_designation || "—"}`,
    `Experience: ${cand.exp_years || 0} years`,
    `Skills: ${(cand.tags || []).join(", ") || "—"}`,
    cand.current_company ? `Current company: ${cand.current_company}` : "",
    cand.function || cand.industry
      ? `Domain: ${[cand.function, cand.industry].filter(Boolean).join(" / ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let parsed: { score?: unknown; matched?: unknown; missing?: unknown; summary?: unknown };
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `JOB TITLE: ${job.title}\n\nJOB DESCRIPTION:\n${stripHtml(job.description || "").slice(0, 6000)}\n\nCANDIDATE:\n${profile}`,
        },
      ],
    });
    const tb = msg.content.find((b) => b.type === "text");
    const out = tb && "text" in tb ? tb.text : "";
    const s = out.indexOf("{");
    const e = out.lastIndexOf("}");
    if (s < 0 || e < 0) throw new Error("Scorer returned no data.");
    parsed = JSON.parse(out.slice(s, e + 1));
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/credit balance|purchase credits|billing/i.test(raw))
      return { ok: false, error: "Anthropic API credits are exhausted — top up in the Console to score resumes." };
    return { ok: false, error: "Scoring failed. " + raw.slice(0, 140) };
  }

  const clean = (v: unknown) =>
    Array.isArray(v) ? v.slice(0, 8).map((x) => String(x)).filter(Boolean) : [];
  const jd_match: JdMatch = {
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    matched: clean(parsed.matched),
    missing: clean(parsed.missing),
    summary: String(parsed.summary || "").slice(0, 240),
    jobId: cand.job_id,
    scoredAt: new Date().toISOString(),
  };

  const { error } = await sb.from("candidates").update({ jd_match }).eq("id", candidateId);
  if (error) {
    if (/jd_match/i.test(error.message))
      return { ok: false, error: "Run migration 0052 (candidate JD score) in Supabase, then try again." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true, score: jd_match.score, match: jd_match };
}
