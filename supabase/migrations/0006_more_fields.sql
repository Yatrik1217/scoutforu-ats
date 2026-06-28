-- Richer recruitment fields (Indian market): candidate CTC/ECTC + notice period,
-- and a client-given budget band on the job/requisition.
alter table public.candidates
  add column current_ctc_lpa numeric not null default 0,
  add column expected_ctc_lpa numeric not null default 0,
  add column notice_period_days integer not null default 0;

alter table public.jobs
  add column min_ctc_lpa numeric not null default 0,
  add column max_ctc_lpa numeric not null default 0;
