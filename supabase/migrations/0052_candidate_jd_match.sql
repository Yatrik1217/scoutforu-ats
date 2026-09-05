-- JD-match score for a candidate against the job they're submitted to.
-- Stored as a single jsonb so no schema churn: { score, matched[], missing[],
-- summary, jobId, scoredAt }. Nullable — a candidate is unscored until the
-- recruiter clicks "Score vs JD".
alter table public.candidates add column if not exists jd_match jsonb;
