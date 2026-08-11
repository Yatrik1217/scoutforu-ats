-- Weekly-off policy for attendance (6-day week with configurable Saturdays).
-- weekly_offs        : weekday numbers always off (0=Sun .. 6=Sat). Default {0}.
-- saturday_off_weeks : which Saturdays-of-the-month are off (1=first .. 5=fifth).
--                      Empty = every Saturday is a working day (true 6-day week).
--                      e.g. {2,4} = 2nd & 4th Saturday off (alternate Saturdays).

alter table public.attendance_settings
  add column if not exists weekly_offs int[] not null default '{0}',
  add column if not exists saturday_off_weeks int[] not null default '{}';
