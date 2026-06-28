-- ScoutforU ATS — schema (README §8)
-- Enums, core tables, indexes. RLS and triggers live in later migrations.

-- ---------- enums ----------
create type user_role as enum ('master_admin', 'recruiter', 'client');
create type job_status as enum ('open', 'hot', 'closed');
create type employment_type as enum ('full_time', 'contract', 'intern');
create type interview_type as enum ('video', 'phone', 'onsite', 'practical');
create type offer_status as enum ('pending', 'accepted');
-- Declared in pipeline order so position = stage index (drives "move next").
create type candidate_stage as enum (
  'sourced',
  'screening',
  'interview',
  'practical_interview',
  'selected',
  'offered',
  'offer_accepted',
  'joined',
  'not_joined'
);

-- ---------- clients (a client-company record this app owns) ----------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Active',
  contact_email text,
  created_at timestamptz not null default now()
);

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'recruiter',
  color text not null default '#2a6fdb',
  client_id uuid references public.clients (id) on delete set null, -- set only for client users
  created_at timestamptz not null default now()
);

-- ---------- jobs / requisitions ----------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  dept text not null default 'Engineering',
  location text not null default 'Bangalore',
  type employment_type not null default 'full_time',
  openings int not null default 1 check (openings >= 0),
  status job_status not null default 'open',
  client_id uuid references public.clients (id) on delete set null,
  recruiter_id uuid references public.profiles (id) on delete set null,
  posted_at timestamptz not null default now(),
  applicants_count int not null default 0,
  description text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- candidates ----------
create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  job_id uuid references public.jobs (id) on delete set null,
  stage candidate_stage not null default 'sourced',
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  exp_years int not null default 0,
  location text,
  source text,
  recruiter_id uuid references public.profiles (id) on delete set null,
  salary_lpa numeric not null default 0,
  tags text[] not null default '{}',
  entered_stage_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- interviews ----------
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  scheduled_at timestamptz not null,
  type interview_type not null default 'video',
  interviewer_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- stage events (drives timeline + activity + time-in-stage) ----------
create table public.stage_events (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  from_stage candidate_stage,
  to_stage candidate_stage not null,
  by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- offers ----------
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  salary_lpa numeric not null default 0,
  sent_at timestamptz not null default now(),
  expires_at timestamptz,
  status offer_status not null default 'pending',
  unique (candidate_id)
);

-- ---------- indexes ----------
create index idx_jobs_client on public.jobs (client_id);
create index idx_jobs_recruiter on public.jobs (recruiter_id);
create index idx_candidates_job on public.candidates (job_id);
create index idx_candidates_recruiter on public.candidates (recruiter_id);
create index idx_candidates_stage on public.candidates (stage);
create index idx_interviews_candidate on public.interviews (candidate_id);
create index idx_interviews_scheduled on public.interviews (scheduled_at);
create index idx_stage_events_candidate on public.stage_events (candidate_id);
create index idx_stage_events_created on public.stage_events (created_at desc);
