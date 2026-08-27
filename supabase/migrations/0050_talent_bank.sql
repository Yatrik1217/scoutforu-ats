-- ============================================================================
-- 0050_talent_bank.sql
-- Talent Bank — a resume dump that is SEPARATE from the candidate pipeline.
-- Recruiters bulk-upload resumes with no opening attached; each is parsed and
-- auto-filed into a technology/domain category. These rows never appear in the
-- pipeline or candidate lists — they're an internal talent database you can
-- later promote into a real opening (which creates a `candidates` row).
-- ============================================================================

create table if not exists public.talent_bank (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  email               text,
  phone               text,
  exp_years           int  not null default 0,
  location            text,
  current_designation text,
  current_company     text,
  skills              text[] not null default '{}',
  category            text not null default 'Other',  -- auto-derived tech/domain bucket
  source              text not null default 'Resume Dump',
  resume_url          text,
  notes               text not null default '',
  added_by            uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists idx_talent_bank_category on public.talent_bank (category);
create index if not exists idx_talent_bank_email on public.talent_bank (lower(email));

alter table public.talent_bank enable row level security;
drop policy if exists talent_bank_all on public.talent_bank;
create policy talent_bank_all on public.talent_bank
  for all using (public.is_staff()) with check (public.is_staff());
