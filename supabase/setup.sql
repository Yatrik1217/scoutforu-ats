-- ScoutforU ATS — full database setup (migrations combined)
-- Paste this whole file into the Supabase SQL editor and Run.

-- ============================================================
-- supabase/migrations/0001_schema.sql
-- ============================================================
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

-- ============================================================
-- supabase/migrations/0002_functions.sql
-- ============================================================
-- ScoutforU ATS — functions & triggers.

-- ===== auth helpers (SECURITY DEFINER avoids RLS recursion in policies) =====
create or replace function public.auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'master_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- staff = master_admin or recruiter (full read across clients)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('master_admin', 'recruiter') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Row scope checks used by RLS. SECURITY DEFINER so the inner lookups don't
-- recurse through the calling user's RLS policies.
create or replace function public.job_in_scope(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1 from public.jobs
      where id = j and client_id = public.auth_client_id()
    );
$$;

create or replace function public.candidate_in_scope(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
      from public.candidates ca
      join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.client_id = public.auth_client_id()
    );
$$;

-- ===== auto-provision a profile when an auth user is created =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role, color, client_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'recruiter'),
    coalesce(new.raw_user_meta_data ->> 'color', '#2a6fdb'),
    nullif(new.raw_user_meta_data ->> 'client_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== reset entered_stage_at when a candidate's stage changes =====
create or replace function public.touch_entered_stage()
returns trigger language plpgsql as $$
begin
  if (new.stage is distinct from old.stage) then
    new.entered_stage_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_entered_stage on public.candidates;
create trigger trg_touch_entered_stage
before update on public.candidates
for each row execute function public.touch_entered_stage();

-- ===== log every stage change as a stage_event =====
-- INSERT logs the initial entry (backdated to entered_stage_at so seeded
-- history reflects real timing); UPDATE logs transitions. by_user_id = actor.
create or replace function public.log_stage_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.stage_events (candidate_id, from_stage, to_stage, by_user_id, created_at)
    values (new.id, null, new.stage, auth.uid(), new.entered_stage_at);
  elsif (new.stage is distinct from old.stage) then
    insert into public.stage_events (candidate_id, from_stage, to_stage, by_user_id)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_stage_event on public.candidates;
create trigger trg_log_stage_event
after insert or update on public.candidates
for each row execute function public.log_stage_event();

-- ===== keep offers in sync with the candidate's stage =====
create or replace function public.handle_offer_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.stage = 'offered' and old.stage is distinct from 'offered') then
    insert into public.offers (candidate_id, salary_lpa, sent_at, expires_at, status)
    values (new.id, new.salary_lpa, now(), now() + interval '7 days', 'pending')
    on conflict (candidate_id)
    do update set salary_lpa = excluded.salary_lpa, sent_at = now(),
                  expires_at = now() + interval '7 days', status = 'pending';
  elsif (tg_op = 'UPDATE' and new.stage = 'offer_accepted' and old.stage is distinct from 'offer_accepted') then
    update public.offers set status = 'accepted' where candidate_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_offer_stage on public.candidates;
create trigger trg_handle_offer_stage
after update on public.candidates
for each row execute function public.handle_offer_stage();

-- ============================================================
-- supabase/migrations/0003_rls.sql
-- ============================================================
-- ScoutforU ATS — Row-Level Security (README §3.4, §6)
-- Roles: master_admin (all) · recruiter (all, read+write) · client (read-only,
-- scoped to their own client's jobs/candidates). Enforced in the DB, not the UI.

alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.interviews enable row level security;
alter table public.stage_events enable row level security;
alter table public.offers enable row level security;

-- ---------- profiles ----------
-- Names appear throughout (recruiter chips, interviewers, client portal), so
-- any authenticated user may read profiles. Writes: admins, or self-updates.
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);
create policy profiles_insert on public.profiles
  for insert with check (public.is_admin());
create policy profiles_update on public.profiles
  for update using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());
create policy profiles_delete on public.profiles
  for delete using (public.is_admin());

-- ---------- clients ----------
create policy clients_select on public.clients
  for select using (public.is_staff() or id = public.auth_client_id());
create policy clients_admin_write on public.clients
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- jobs ----------
create policy jobs_select on public.jobs
  for select using (public.job_in_scope(id));
create policy jobs_staff_write on public.jobs
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- candidates ----------
create policy candidates_select on public.candidates
  for select using (public.candidate_in_scope(id));
create policy candidates_staff_write on public.candidates
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- interviews ----------
create policy interviews_select on public.interviews
  for select using (public.candidate_in_scope(candidate_id));
create policy interviews_staff_write on public.interviews
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- stage_events ----------
-- (Inserts normally come from the SECURITY DEFINER trigger, which bypasses RLS;
-- the policy covers any direct staff writes.)
create policy stage_events_select on public.stage_events
  for select using (public.candidate_in_scope(candidate_id));
create policy stage_events_staff_write on public.stage_events
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- offers ----------
create policy offers_select on public.offers
  for select using (public.candidate_in_scope(candidate_id));
create policy offers_staff_write on public.offers
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------- realtime ----------
-- Broadcast row changes so all users see updates live (RLS still applies).
alter publication supabase_realtime add table public.candidates;
alter publication supabase_realtime add table public.stage_events;
alter publication supabase_realtime add table public.interviews;
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.offers;

-- ============================================================
-- supabase/migrations/0004_settings.sql
-- ============================================================
-- App-wide settings (Admin → Settings toggles). Single row.
create table public.app_settings (
  id boolean primary key default true check (id),
  email_notif boolean not null default true,
  auto_reject boolean not null default false,
  client_portal boolean not null default true,
  two_factor boolean not null default true
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select using (auth.uid() is not null);
create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- supabase/migrations/0005_profile_active.sql
-- ============================================================
-- Recruiter activation: deactivated users are blocked from signing in and
-- excluded from assignment lists, but their historical data is preserved.
alter table public.profiles
  add column active boolean not null default true;

-- ============================================================
-- supabase/migrations/0006_more_fields.sql
-- ============================================================
-- Richer recruitment fields (Indian market): candidate CTC/ECTC + notice period,
-- and a client-given budget band on the job/requisition.
alter table public.candidates
  add column current_ctc_lpa numeric not null default 0,
  add column expected_ctc_lpa numeric not null default 0,
  add column notice_period_days integer not null default 0;

alter table public.jobs
  add column min_ctc_lpa numeric not null default 0,
  add column max_ctc_lpa numeric not null default 0;

