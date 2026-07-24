-- Standard working hours, so attendance can flag late arrival and short days.
-- Times are stored as wall-clock 'HH:MM' in the app timezone (IST).

create table if not exists public.attendance_settings (
  id boolean primary key default true,
  shift_start text not null default '10:00',
  shift_end text not null default '19:00',
  grace_minutes int not null default 10,      -- minutes late still counted on-time
  full_day_hours numeric not null default 8,   -- net hours for a full day
  half_day_hours numeric not null default 4,   -- below this = half day
  updated_at timestamptz not null default now(),
  constraint attendance_settings_singleton check (id)
);
insert into public.attendance_settings (id) values (true) on conflict do nothing;

alter table public.attendance_settings enable row level security;
drop policy if exists attendance_settings_read on public.attendance_settings;
create policy attendance_settings_read on public.attendance_settings
  for select using (public.is_staff());
drop policy if exists attendance_settings_admin on public.attendance_settings;
create policy attendance_settings_admin on public.attendance_settings
  for all using (public.is_admin()) with check (public.is_admin());
