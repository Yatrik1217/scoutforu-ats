-- Assign one job to MULTIPLE recruiters (co-recruiting).
-- jobs.recruiter_id stays as the LEAD owner (drives "owned by" display and all
-- existing behaviour). This join table holds the full assigned set (lead + any
-- co-recruiters). A recruiter may see/work a job if they are the lead OR listed
-- here; they see that job's candidates the same way.
--
-- Safe to re-run.

create table if not exists public.job_recruiters (
  job_id uuid not null references public.jobs(id) on delete cascade,
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (job_id, recruiter_id)
);
create index if not exists job_recruiters_recruiter_idx on public.job_recruiters (recruiter_id);

-- Seed with each job's current single owner so nothing changes for existing jobs.
insert into public.job_recruiters (job_id, recruiter_id)
  select id, recruiter_id from public.jobs where recruiter_id is not null
  on conflict do nothing;

-- ---------- scope helpers now also honour job_recruiters membership ----------
create or replace function public.job_in_scope(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.jobs where id = j and recruiter_id = auth.uid())
    or exists (select 1 from public.job_recruiters where job_id = j and recruiter_id = auth.uid())
    or exists (select 1 from public.jobs where id = j and client_id = public.auth_client_id());
$$;

create or replace function public.job_writable(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.jobs where id = j and recruiter_id = auth.uid())
    or exists (select 1 from public.job_recruiters where job_id = j and recruiter_id = auth.uid());
$$;

create or replace function public.candidate_in_scope(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.candidates where id = c and recruiter_id = auth.uid())
    or exists (
      select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.recruiter_id = auth.uid()
    )
    or exists (
      select 1 from public.candidates ca join public.job_recruiters jr on jr.job_id = ca.job_id
      where ca.id = c and jr.recruiter_id = auth.uid()
    )
    or exists (
      select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.client_id = public.auth_client_id()
    );
$$;

create or replace function public.candidate_writable(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.candidates where id = c and recruiter_id = auth.uid())
    or exists (
      select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.recruiter_id = auth.uid()
    )
    or exists (
      select 1 from public.candidates ca join public.job_recruiters jr on jr.job_id = ca.job_id
      where ca.id = c and jr.recruiter_id = auth.uid()
    );
$$;

-- ---------- RLS for the join table ----------
alter table public.job_recruiters enable row level security;

drop policy if exists job_recruiters_select on public.job_recruiters;
create policy job_recruiters_select on public.job_recruiters
  for select using (public.job_in_scope(job_id));

-- Only the admin or the job's LEAD recruiter may add/remove assignees.
drop policy if exists job_recruiters_write on public.job_recruiters;
create policy job_recruiters_write on public.job_recruiters
  for all
  using (
    public.is_admin()
    or exists (select 1 from public.jobs where id = job_id and recruiter_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.jobs where id = job_id and recruiter_id = auth.uid())
  );
