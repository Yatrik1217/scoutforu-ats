-- Attendance as multiple work sessions per day.
--
-- A day is not "one check-in and one check-out": people step out for tea, for
-- lunch, for a bank run, and come back. Each in/out pair is a session; the gaps
-- between them ARE the breaks. So:
--   Gross  = first check-in  ->  last check-out
--   Net    = sum of the sessions
--   Break  = gross - net
--
-- shape: [{"in":"2026-07-23T04:00:00Z","out":"2026-07-23T07:30:00Z"}, ...]
-- The last entry has out = null while the person is currently in.

alter table public.attendance
  add column if not exists sessions jsonb not null default '[]';

-- Carry existing single check-in/out rows over as one session.
update public.attendance
   set sessions = jsonb_build_array(
         jsonb_build_object('in', check_in_at, 'out', check_out_at))
 where check_in_at is not null
   and jsonb_array_length(sessions) = 0;
