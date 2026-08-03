-- Recruiter DB-level isolation (README §3.4 update).
-- Until now RLS treated every "staff" member (master_admin OR recruiter) as
-- able to read/write ALL jobs & candidates. This tightens it so a RECRUITER only
-- sees/manages the openings assigned to them (jobs.recruiter_id) and the
-- candidates on those openings (or assigned directly to them). Master admins keep
-- full access; clients keep their existing read-only, client-scoped access.
--
-- Two parts:
--   (1) redefine the SELECT scope functions so a recruiter is scoped to "their own"
--   (2) replace the blanket `for all` write policies — those ALSO granted SELECT to
--       every staff member (permissive policies are OR-ed), which would defeat (1).
--
-- Safe to re-run. Rollback snippet at the bottom.

-- ---------- (1) SELECT scope: recruiter now = their own rows ----------
create or replace function public.job_in_scope(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.jobs where id = j and recruiter_id = auth.uid())
    or exists (select 1 from public.jobs where id = j and client_id = public.auth_client_id());
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
      select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.client_id = public.auth_client_id()
    );
$$;

-- Write-scope helpers (admin, or the owning recruiter).
create or replace function public.job_writable(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.jobs where id = j and recruiter_id = auth.uid());
$$;

create or replace function public.candidate_writable(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.candidates where id = c and recruiter_id = auth.uid())
    or exists (
      select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.recruiter_id = auth.uid()
    );
$$;

-- ---------- (2) split the blanket write policies ----------
-- jobs: any staff may create; only admin or the owning recruiter may edit/delete.
drop policy if exists jobs_staff_write on public.jobs;
create policy jobs_insert on public.jobs for insert with check (public.is_staff());
create policy jobs_update on public.jobs for update
  using (public.job_writable(id)) with check (public.job_writable(id));
create policy jobs_delete on public.jobs for delete using (public.job_writable(id));

-- candidates: any staff may create; edit/delete limited to admin or owner.
drop policy if exists candidates_staff_write on public.candidates;
create policy candidates_insert on public.candidates for insert with check (public.is_staff());
create policy candidates_update on public.candidates for update
  using (public.candidate_writable(id)) with check (public.candidate_writable(id));
create policy candidates_delete on public.candidates for delete using (public.candidate_writable(id));

-- interviews / stage_events / offers: SELECT is already scoped via
-- candidate_in_scope; here we just stop the blanket `for all` from leaking SELECT.
-- Writes stay open to staff on insert (a recruiter can't see others' candidates,
-- so they can't target them), scoped to in-scope candidates for edit/delete.
drop policy if exists interviews_staff_write on public.interviews;
create policy interviews_insert on public.interviews for insert with check (public.is_staff());
create policy interviews_update on public.interviews for update
  using (public.candidate_in_scope(candidate_id)) with check (public.is_staff());
create policy interviews_delete on public.interviews for delete
  using (public.candidate_in_scope(candidate_id));

drop policy if exists stage_events_staff_write on public.stage_events;
create policy stage_events_insert on public.stage_events for insert with check (public.is_staff());
create policy stage_events_update on public.stage_events for update
  using (public.candidate_in_scope(candidate_id)) with check (public.is_staff());
create policy stage_events_delete on public.stage_events for delete
  using (public.candidate_in_scope(candidate_id));

drop policy if exists offers_staff_write on public.offers;
create policy offers_insert on public.offers for insert with check (public.is_staff());
create policy offers_update on public.offers for update
  using (public.candidate_in_scope(candidate_id)) with check (public.is_staff());
create policy offers_delete on public.offers for delete
  using (public.candidate_in_scope(candidate_id));

-- ============================================================================
-- ROLLBACK (paste to undo — restores the old "all staff see/write everything"):
--
--   create or replace function public.job_in_scope(j uuid)
--   returns boolean language sql stable security definer set search_path = public as $$
--     select public.is_staff() or exists (
--       select 1 from public.jobs where id = j and client_id = public.auth_client_id());
--   $$;
--   create or replace function public.candidate_in_scope(c uuid)
--   returns boolean language sql stable security definer set search_path = public as $$
--     select public.is_staff() or exists (
--       select 1 from public.candidates ca join public.jobs jb on jb.id = ca.job_id
--       where ca.id = c and jb.client_id = public.auth_client_id());
--   $$;
--   drop policy if exists jobs_insert on public.jobs;
--   drop policy if exists jobs_update on public.jobs;
--   drop policy if exists jobs_delete on public.jobs;
--   create policy jobs_staff_write on public.jobs for all
--     using (public.is_staff()) with check (public.is_staff());
--   drop policy if exists candidates_insert on public.candidates;
--   drop policy if exists candidates_update on public.candidates;
--   drop policy if exists candidates_delete on public.candidates;
--   create policy candidates_staff_write on public.candidates for all
--     using (public.is_staff()) with check (public.is_staff());
--   drop policy if exists interviews_insert on public.interviews;
--   drop policy if exists interviews_update on public.interviews;
--   drop policy if exists interviews_delete on public.interviews;
--   create policy interviews_staff_write on public.interviews for all
--     using (public.is_staff()) with check (public.is_staff());
--   drop policy if exists stage_events_insert on public.stage_events;
--   drop policy if exists stage_events_update on public.stage_events;
--   drop policy if exists stage_events_delete on public.stage_events;
--   create policy stage_events_staff_write on public.stage_events for all
--     using (public.is_staff()) with check (public.is_staff());
--   drop policy if exists offers_insert on public.offers;
--   drop policy if exists offers_update on public.offers;
--   drop policy if exists offers_delete on public.offers;
--   create policy offers_staff_write on public.offers for all
--     using (public.is_staff()) with check (public.is_staff());
-- ============================================================================
