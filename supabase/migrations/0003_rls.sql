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
