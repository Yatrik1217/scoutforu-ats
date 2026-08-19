-- Employee HRMS profile: one master record for everyone.
--
-- The `employees` table already carries the HR essentials (code, salary, bank,
-- statutory). This migration rounds it into a full profile and — crucially —
-- lets a single record represent BOTH kinds of staff:
--
--   * ATS staff (recruiters/internal) — attendance & leave live in this ATS,
--     in the `attendance` / `leave_requests` tables (attendance_source = 'ats').
--   * CRM salespeople — attendance & leave happen in the Outreach CRM. We keep
--     their HR master here but READ their attendance read-only from the CRM
--     blob, keyed by `crm_user_id` (attendance_source = 'crm').
--
-- Shifts stay a single org-wide setting (attendance_settings); nothing here
-- introduces per-employee shifts.

alter table public.employees
  add column if not exists attendance_source text not null default 'ats'
    check (attendance_source in ('ats', 'crm')),
  add column if not exists crm_user_id text not null default '',
  add column if not exists dob date,
  add column if not exists gender text not null default '',
  add column if not exists address text not null default '',
  add column if not exists emergency_name text not null default '',
  add column if not exists emergency_phone text not null default '';

-- One ATS employee record per CRM person.
create unique index if not exists employees_crm_user_uidx
  on public.employees (crm_user_id) where crm_user_id <> '';
