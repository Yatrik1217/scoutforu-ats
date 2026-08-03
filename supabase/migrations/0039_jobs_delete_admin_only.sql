-- Deleting an opening (JD) is destructive and hard to undo — restrict it to
-- master admins only. Recruiters keep create + edit on their own openings, but
-- can no longer delete any. (Tightens jobs_delete from 0038's admin-or-owner.)

drop policy if exists jobs_delete on public.jobs;
create policy jobs_delete on public.jobs
  for delete using (public.is_admin());

-- Rollback (restore admin-or-owner delete):
--   drop policy if exists jobs_delete on public.jobs;
--   create policy jobs_delete on public.jobs for delete using (public.job_writable(id));
