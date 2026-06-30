-- Recruiter notes/comments on a candidate (collaboration + activity history).
create table public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_candidate_notes_candidate on public.candidate_notes (candidate_id);

alter table public.candidate_notes enable row level security;

create policy candidate_notes_select on public.candidate_notes
  for select using (public.candidate_in_scope(candidate_id));
create policy candidate_notes_staff_write on public.candidate_notes
  for all using (public.is_staff()) with check (public.is_staff());

alter publication supabase_realtime add table public.candidate_notes;
