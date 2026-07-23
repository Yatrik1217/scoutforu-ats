-- Attendance with self check-in. One row per employee per day.
-- Absent / half-day rows feed payroll as loss of pay, combined with unpaid
-- leave (a day counted by both is only ever docked once).

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  on_date date not null,
  status text not null default 'present'
    check (status in ('present','absent','half_day','leave','week_off','holiday')),
  check_in_at timestamptz,
  check_out_at timestamptz,
  note text not null default '',
  marked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, on_date)
);
create index if not exists attendance_emp_idx on public.attendance (employee_id);
create index if not exists attendance_date_idx on public.attendance (on_date);

alter table public.attendance enable row level security;

drop policy if exists attendance_admin on public.attendance;
create policy attendance_admin on public.attendance
  for all using (public.is_admin()) with check (public.is_admin());

-- Staff see and mark only their own attendance.
drop policy if exists attendance_self_read on public.attendance;
create policy attendance_self_read on public.attendance
  for select using (employee_id = public.my_employee_id());
drop policy if exists attendance_self_insert on public.attendance;
create policy attendance_self_insert on public.attendance
  for insert with check (employee_id = public.my_employee_id());
drop policy if exists attendance_self_update on public.attendance;
create policy attendance_self_update on public.attendance
  for update using (employee_id = public.my_employee_id())
  with check (employee_id = public.my_employee_id());
