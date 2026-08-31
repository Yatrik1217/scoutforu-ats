-- ============================================================================
-- 0051_public_jobs_security_invoker.sql
-- Resolve the Supabase Advisor "Security Definer View" finding on public_jobs,
-- and make it strictly least-privilege in the process.
--
-- Before: public_jobs was a SECURITY DEFINER view (ran as owner, bypassing RLS)
-- that redacted the client name out of the description via a clients join.
-- Flipping it to security_invoker naively would force granting the public read
-- access to the RAW jobs.description (which can contain the client name) — a
-- leak. So instead we pre-compute a redacted `public_description` on jobs and
-- expose ONLY that (plus other safe columns) to the anon role, then run the
-- view as the invoker.
-- ============================================================================

begin;

-- 1. A pre-redacted description column, kept in sync by a trigger. The public
--    never sees the raw description.
alter table public.jobs add column if not exists public_description text;

create or replace function public.set_public_description()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text;
begin
  select nullif(trim(c.name), '') into cname from public.clients c where c.id = new.client_id;
  new.public_description := case
    when cname is not null then replace(coalesce(new.description, ''), cname, '—')
    else coalesce(new.description, '')
  end;
  return new;
end $$;

drop trigger if exists trg_set_public_description on public.jobs;
create trigger trg_set_public_description
before insert or update of description, client_id on public.jobs
for each row execute function public.set_public_description();

-- Backfill existing rows.
with red as (
  select j.id,
    case
      when c.name is not null and length(trim(c.name)) > 0
        then replace(coalesce(j.description, ''), c.name, '—')
      else coalesce(j.description, '')
    end as pd
  from public.jobs j
  left join public.clients c on c.id = j.client_id
)
update public.jobs j set public_description = red.pd from red where red.id = j.id;

-- 2. The view now runs as the INVOKER, reads only the redacted column, and
--    needs no clients join.
create or replace view public.public_jobs with (security_invoker = true) as
select
  j.id,
  j.title,
  j.dept,
  j.location,
  j.type,
  j.exp_min,
  j.exp_max,
  j.openings,
  j.posted_at,
  j.public_description as description
from public.jobs j
where j.published = true
  and j.approval_status = 'approved';

-- 3. Least-privilege for the public: the anon role may read ONLY the safe
--    columns, and ONLY published + approved rows (never the raw description,
--    recruiter, client, salary, applicant counts, etc.).
revoke select on public.jobs from anon;
grant select
  (id, title, dept, location, type, exp_min, exp_max, openings, posted_at, public_description)
  on public.jobs to anon;

drop policy if exists jobs_public_read on public.jobs;
create policy jobs_public_read on public.jobs
  for select to anon
  using (published = true and approval_status = 'approved');

grant select on public.public_jobs to anon, authenticated;

commit;
