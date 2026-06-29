-- Richer job & client records (matching a mature recruitment ATS).

alter table public.jobs
  add column if not exists designation text not null default '',
  add column if not exists target_date date,
  add column if not exists reference_code text not null default '',
  add column if not exists interviewer_hr text not null default '',
  add column if not exists interview_venue text not null default '',
  add column if not exists remote_work boolean not null default false,
  add column if not exists exp_min numeric not null default 0,
  add column if not exists exp_max numeric not null default 0,
  add column if not exists functional_area text not null default '',
  add column if not exists industry text not null default '',
  add column if not exists qualification text not null default '',
  add column if not exists keywords text not null default '',
  add column if not exists profile_criteria text not null default '',
  add column if not exists benefits text not null default '',
  add column if not exists hide_salary boolean not null default false,
  add column if not exists walk_in boolean not null default false,
  add column if not exists telephonic boolean not null default false;

alter table public.clients
  add column if not exists city text not null default '',
  add column if not exists reference_code text not null default '',
  add column if not exists rating text not null default '',
  add column if not exists industry text not null default '',
  add column if not exists contact_number text not null default '',
  add column if not exists key_account_manager_id uuid references public.profiles (id) on delete set null,
  add column if not exists transportation boolean not null default false,
  add column if not exists canteen boolean not null default false,
  add column if not exists website text not null default '',
  add column if not exists linkedin_url text not null default '',
  add column if not exists address text not null default '',
  add column if not exists profile text not null default '',
  add column if not exists remarks text not null default '';
