-- Access policies for the private "resumes" storage bucket: only staff
-- (master_admin / recruiter) can upload, read, or delete resume files.
create policy "resumes staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.is_staff());

create policy "resumes staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and public.is_staff());

create policy "resumes staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resumes' and public.is_staff());
