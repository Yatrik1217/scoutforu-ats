-- Approvers: staff who can approve job requisitions. Recruiter-created jobs
-- start pending; approvers/admins approve them before they go live publicly.
alter table public.profiles add column if not exists is_approver boolean not null default false;
alter table public.jobs add column if not exists approval_status text not null default 'approved'
  check (approval_status in ('pending', 'approved', 'rejected'));

-- Default email templates with {{placeholders}}.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;
create policy email_templates_select on public.email_templates
  for select using (public.is_staff());
create policy email_templates_admin_write on public.email_templates
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.email_templates (template_key, name, subject, body) values
  ('client_submission', 'Client submission (tracker + résumés)',
   'Candidate submission — {{count}} profile(s) for {{client_name}}',
   'Hi {{client_name}} team,' || chr(10) || chr(10) ||
   'Please find attached the candidate tracker and résumés for your review.' || chr(10) || chr(10) ||
   'Regards,' || chr(10) || '{{sender_name}}'),
  ('interview_invite', 'Interview invite (candidate)',
   'Interview scheduled — {{job_title}}',
   'Dear {{candidate_name}},' || chr(10) || chr(10) ||
   'Your interview for {{job_title}} has been scheduled. Details will follow shortly.' || chr(10) || chr(10) ||
   'Regards,' || chr(10) || '{{sender_name}}')
on conflict (template_key) do nothing;

-- Invoice settings (single row).
create table public.invoice_settings (
  id boolean primary key default true,
  prefix text not null default 'INV-',
  next_number int not null default 1,
  gst_percent numeric not null default 18,
  pan text not null default '',
  gstin text not null default '',
  bank_details text not null default '',
  terms text not null default '',
  updated_at timestamptz not null default now(),
  constraint invoice_settings_singleton check (id)
);
insert into public.invoice_settings (id) values (true) on conflict do nothing;

alter table public.invoice_settings enable row level security;
create policy invoice_settings_select on public.invoice_settings
  for select using (public.is_staff());
create policy invoice_settings_admin_write on public.invoice_settings
  for all using (public.is_admin()) with check (public.is_admin());
