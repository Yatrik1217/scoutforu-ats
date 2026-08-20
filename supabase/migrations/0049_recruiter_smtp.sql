-- ============================================================================
-- 0049_recruiter_smtp.sql
-- Per-recruiter email sending. Candidate-facing emails (interview invites,
-- stage auto-emails, the Message box) should come FROM the recruiter who acted,
-- through their own mailbox — mirroring the CRM's per-user SMTP.
--
-- Each recruiter stores their own SMTP credentials here. Until a recruiter sets
-- theirs up, sends fall back to the shared company mailbox, stamped with the
-- recruiter's name + reply-to (handled in app code).
-- ============================================================================

create table if not exists public.user_email_settings (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  smtp_host  text not null,
  smtp_port  int  not null default 465,
  smtp_user  text not null,
  smtp_pass  text not null,               -- an app-specific password (sensitive)
  from_name  text not null default '',
  verified   boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_email_settings enable row level security;

-- A recruiter manages only their OWN mailbox row; admins can manage any.
-- (The config page never selects smtp_pass back to the browser.)
drop policy if exists user_email_self on public.user_email_settings;
create policy user_email_self on public.user_email_settings
  for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
