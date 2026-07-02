-- Per-recruiter API token used by the Naukri Resdex browser extension to import
-- candidates into the ATS without a full login session.
alter table public.profiles
  add column if not exists api_token text unique;
