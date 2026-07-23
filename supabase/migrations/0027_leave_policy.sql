-- Leave policy: 12 paid leaves a year in a single bucket, and nothing paid
-- during the first 3 months of probation — leave taken then is LWP.
-- Safe to run whether or not 0026 has already been applied.

alter table public.employees
  add column if not exists probation_months int not null default 3;

-- Single annual bucket + unpaid.
insert into public.leave_types (name, code, annual_quota, paid, sort) values
  ('Annual Leave', 'AL', 12, true, 1),
  ('Unpaid Leave', 'LWP', 0, false, 2)
on conflict (code) do nothing;

update public.leave_types set annual_quota = 12, paid = true, active = true, sort = 1
 where code = 'AL';
update public.leave_types set annual_quota = 0, paid = false, active = true, sort = 2
 where code = 'LWP';

-- Retire the split types seeded earlier (kept, not deleted, so any existing
-- requests stay intact and reportable).
update public.leave_types set active = false where code in ('CL', 'SL', 'EL');
