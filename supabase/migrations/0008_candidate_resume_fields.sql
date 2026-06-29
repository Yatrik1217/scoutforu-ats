-- Full "resume" detail on candidates (matching the Manage Resume form).
alter table public.candidates
  add column if not exists gender text not null default '',
  add column if not exists current_designation text not null default '',
  add column if not exists current_company text not null default '',
  add column if not exists graduation text not null default '',
  add column if not exists post_graduation text not null default '',
  add column if not exists birth_date date,
  add column if not exists marital_status text not null default '',
  add column if not exists alt_email text not null default '',
  add column if not exists alt_phone text not null default '',
  add column if not exists function text not null default '',
  add column if not exists industry text not null default '',
  add column if not exists resume_url text not null default '';
