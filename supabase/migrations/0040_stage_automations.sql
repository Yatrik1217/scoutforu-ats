-- Automation: when a candidate moves to a stage, optionally auto-send an email
-- template to them. One rule per pipeline stage (admin-configured).
create table if not exists public.stage_email_rules (
  stage text primary key,
  template_id uuid references public.email_templates(id) on delete set null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.stage_email_rules enable row level security;
create policy stage_email_rules_select on public.stage_email_rules
  for select using (public.is_staff());
create policy stage_email_rules_write on public.stage_email_rules
  for all using (public.is_admin()) with check (public.is_admin());
