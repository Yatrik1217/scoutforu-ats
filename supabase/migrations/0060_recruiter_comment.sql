-- Recruiter's comment on a candidate: the recruiter's own assessment / pitch
-- shown to the client in the submissions tracker. Mandatory before a candidate
-- can move to the Client-Submit stage (enforced in app code), so every
-- submitted profile carries the recruiter's note.

alter table public.candidates
  add column if not exists recruiter_comment text not null default '';
