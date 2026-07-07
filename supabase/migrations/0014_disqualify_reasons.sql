-- Disqualify (rejection) reasons — a managed list shown when rejecting a candidate.
create table public.disqualify_reasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Reason chosen when a candidate is rejected.
alter table public.candidates add column if not exists reject_reason text not null default '';

alter table public.disqualify_reasons enable row level security;

create policy disqualify_reasons_select on public.disqualify_reasons
  for select using (public.is_staff());
create policy disqualify_reasons_staff_write on public.disqualify_reasons
  for all using (public.is_staff()) with check (public.is_staff());

-- A few sensible defaults.
insert into public.disqualify_reasons (label, sort) values
  ('Salary expectations too high', 10),
  ('Not enough relevant experience', 20),
  ('Location / relocation mismatch', 30),
  ('Failed the interview', 40),
  ('Candidate not interested', 50),
  ('Position filled / on hold', 60),
  ('Notice period too long', 70),
  ('Counter-offer accepted', 80);
