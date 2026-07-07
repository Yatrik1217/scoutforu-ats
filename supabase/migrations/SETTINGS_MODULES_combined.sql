-- ScoutforU: settings modules (Disqualify Reasons, Organization+Branches, Custom Fields)
-- Run once in Supabase → SQL Editor.

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

-- Organization profile (single row) used across the ATS + the public careers page.
create table public.organization (
  id boolean primary key default true,
  name text not null default '',
  tagline text not null default '',
  logo_url text not null default '',
  address text not null default '',
  city text not null default '',
  gst text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  updated_at timestamptz not null default now(),
  constraint organization_singleton check (id)
);
insert into public.organization (id) values (true) on conflict do nothing;

-- Branches / units / divisions.
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  address text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.jobs add column if not exists branch_id uuid references public.branches (id) on delete set null;

alter table public.organization enable row level security;
create policy organization_select on public.organization
  for select using (public.is_staff());
create policy organization_admin_write on public.organization
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.branches enable row level security;
create policy branches_select on public.branches
  for select using (public.is_staff());
create policy branches_staff_write on public.branches
  for all using (public.is_staff()) with check (public.is_staff());

-- Admin-defined custom fields for candidates / jobs / clients.
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('candidate', 'job', 'client')),
  label text not null,
  field_key text not null,
  type text not null default 'text' check (type in ('text', 'number', 'select')),
  options text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (module, field_key)
);

-- Values are stored as JSON on the entity, keyed by field_key.
alter table public.candidates add column if not exists custom jsonb not null default '{}';
alter table public.jobs add column if not exists custom jsonb not null default '{}';
alter table public.clients add column if not exists custom jsonb not null default '{}';

alter table public.custom_fields enable row level security;
create policy custom_fields_select on public.custom_fields
  for select using (public.is_staff());
create policy custom_fields_staff_write on public.custom_fields
  for all using (public.is_staff()) with check (public.is_staff());
