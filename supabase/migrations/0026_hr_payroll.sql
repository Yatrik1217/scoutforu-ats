-- ScoutforU Employee Portal — staff records, leave and monthly payroll.
-- Employees are a separate table from `profiles` so people who don't use the
-- ATS (accounts, office staff) can still be paid; profile_id links the ones
-- who do have a login, which is what powers self-service leave and payslips.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  employee_code text not null default '',
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  designation text not null default '',
  department text not null default '',
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','intern','contract')),
  joined_on date,
  exit_on date,
  status text not null default 'active' check (status in ('active','exited')),
  -- Salary: monthly gross today; `components` is reserved for a future
  -- Basic/HRA/allowance breakdown without needing a schema change.
  monthly_gross numeric not null default 0,
  components jsonb not null default '{}',
  pan text not null default '',
  bank_account text not null default '',
  bank_ifsc text not null default '',
  uan text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists employees_profile_uidx
  on public.employees (profile_id) where profile_id is not null;
create index if not exists employees_status_idx on public.employees (status);

-- Which employee row belongs to the signed-in user (drives self-service RLS).
create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where profile_id = auth.uid() limit 1;
$$;

-- ---- leave ---------------------------------------------------------------
create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  annual_quota numeric not null default 0,
  paid boolean not null default true,   -- unpaid types drive loss-of-pay
  active boolean not null default true,
  sort int not null default 0
);
insert into public.leave_types (name, code, annual_quota, paid, sort) values
  ('Casual Leave', 'CL', 12, true, 1),
  ('Sick Leave', 'SL', 6, true, 2),
  ('Earned Leave', 'EL', 12, true, 3),
  ('Unpaid Leave', 'LWP', 0, false, 4)
on conflict (code) do nothing;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid not null references public.leave_types(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  days numeric not null default 1,      -- supports half days (0.5)
  half_day boolean not null default false,
  reason text not null default '',
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists leave_requests_emp_idx on public.leave_requests (employee_id);
create index if not exists leave_requests_status_idx on public.leave_requests (status);
create index if not exists leave_requests_from_idx on public.leave_requests (from_date);

-- ---- payroll -------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,     -- always the 1st of the month
  status text not null default 'draft' check (status in ('draft','finalised','paid')),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  finalised_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  monthly_gross numeric not null default 0,
  total_days int not null default 30,
  lop_days numeric not null default 0,
  earned_gross numeric not null default 0,   -- gross prorated for loss of pay
  incentive numeric not null default 0,      -- pulled from the incentive plan
  -- [{ "label": "Bonus", "amount": 5000 }]
  additions jsonb not null default '[]',
  -- [{ "label": "Professional Tax", "amount": 200 }]
  deductions jsonb not null default '[]',
  net_pay numeric not null default 0,
  notes text not null default '',
  unique (run_id, employee_id)
);
create index if not exists payroll_lines_run_idx on public.payroll_lines (run_id);
create index if not exists payroll_lines_emp_idx on public.payroll_lines (employee_id);

-- ---- RLS -----------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;

-- Employees: admin manages everyone; a user can read their own record.
drop policy if exists employees_admin on public.employees;
create policy employees_admin on public.employees
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists employees_self_read on public.employees;
create policy employees_self_read on public.employees
  for select using (profile_id = auth.uid());

-- Leave types: any signed-in staff member can read them; admin edits.
drop policy if exists leave_types_read on public.leave_types;
create policy leave_types_read on public.leave_types
  for select using (public.is_staff());
drop policy if exists leave_types_admin on public.leave_types;
create policy leave_types_admin on public.leave_types
  for all using (public.is_admin()) with check (public.is_admin());

-- Leave requests: staff apply for and see their own; admin sees/decides all.
drop policy if exists leave_requests_admin on public.leave_requests;
create policy leave_requests_admin on public.leave_requests
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists leave_requests_self_read on public.leave_requests;
create policy leave_requests_self_read on public.leave_requests
  for select using (employee_id = public.my_employee_id());
drop policy if exists leave_requests_self_insert on public.leave_requests;
create policy leave_requests_self_insert on public.leave_requests
  for insert with check (employee_id = public.my_employee_id() and status = 'pending');
-- Staff may only withdraw their own request while it is still pending.
drop policy if exists leave_requests_self_cancel on public.leave_requests;
create policy leave_requests_self_cancel on public.leave_requests
  for update using (employee_id = public.my_employee_id() and status = 'pending')
  with check (employee_id = public.my_employee_id());

-- Payroll: admin only, except an employee reading their own payslip lines.
drop policy if exists payroll_runs_admin on public.payroll_runs;
create policy payroll_runs_admin on public.payroll_runs
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists payroll_runs_self_read on public.payroll_runs;
create policy payroll_runs_self_read on public.payroll_runs
  for select using (
    status <> 'draft'
    and exists (
      select 1 from public.payroll_lines l
       where l.run_id = payroll_runs.id and l.employee_id = public.my_employee_id()
    )
  );

drop policy if exists payroll_lines_admin on public.payroll_lines;
create policy payroll_lines_admin on public.payroll_lines
  for all using (public.is_admin()) with check (public.is_admin());
-- Payslips only become visible once the run leaves draft.
drop policy if exists payroll_lines_self_read on public.payroll_lines;
create policy payroll_lines_self_read on public.payroll_lines
  for select using (
    employee_id = public.my_employee_id()
    and exists (
      select 1 from public.payroll_runs r
       where r.id = payroll_lines.run_id and r.status <> 'draft'
    )
  );

-- Seed employee records from existing staff logins (safe to re-run).
insert into public.employees (profile_id, name, email, status, designation)
select p.id, p.name, p.email, case when p.active then 'active' else 'exited' end,
       case when p.role = 'master_admin' then 'Director' else 'Recruiter' end
  from public.profiles p
 where p.role <> 'client'
   and not exists (select 1 from public.employees e where e.profile_id = p.id);
