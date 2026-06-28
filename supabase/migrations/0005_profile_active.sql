-- Recruiter activation: deactivated users are blocked from signing in and
-- excluded from assignment lists, but their historical data is preserved.
alter table public.profiles
  add column active boolean not null default true;
