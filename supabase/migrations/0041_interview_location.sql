-- Interviews can carry a location / meeting link and notes, included in the
-- email invite (+ calendar .ics) sent to the candidate and interviewer.
alter table public.interviews
  add column if not exists location text not null default '',
  add column if not exists notes text not null default '';
