-- Lunch / tea breaks on the attendance record, so we can report gross hours
-- (check-in to check-out) and net hours (gross minus break time).
-- Shape: [{"start":"2026-07-23T08:00:00Z","end":"2026-07-23T08:45:00Z"}]
-- The last entry may have a null end while the break is still running.

alter table public.attendance
  add column if not exists breaks jsonb not null default '[]';
