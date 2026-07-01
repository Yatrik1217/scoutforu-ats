-- Interview scorecards: interviewers rate a candidate + give a recommendation.
create type feedback_recommendation as enum (
  'strong_yes',
  'yes',
  'maybe',
  'no',
  'strong_no'
);

create table public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  interviewer_id uuid references public.profiles (id) on delete set null,
  rating int not null default 0 check (rating >= 0 and rating <= 5),
  recommendation feedback_recommendation not null default 'maybe',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index idx_feedback_candidate on public.interview_feedback (candidate_id);

alter table public.interview_feedback enable row level security;

create policy feedback_select on public.interview_feedback
  for select using (public.candidate_in_scope(candidate_id));
create policy feedback_staff_write on public.interview_feedback
  for all using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.interview_feedback;
