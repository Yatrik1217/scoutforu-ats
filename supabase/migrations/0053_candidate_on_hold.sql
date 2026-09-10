-- Candidate "On Hold" state — for resumes submitted to a client with no update,
-- or a position put on hold. Held candidates keep their real stage but drop out
-- of the active pipeline board so they don't clutter reviews; they stay attached
-- to their opening and are viewable via the board's "On Hold" chip. Reversible.

alter table candidates
  add column if not exists on_hold     boolean     not null default false,
  add column if not exists hold_reason text        not null default '',
  add column if not exists held_at     timestamptz;

-- Fast lookup of held candidates per opening.
create index if not exists candidates_on_hold_idx
  on candidates (job_id) where on_hold;
