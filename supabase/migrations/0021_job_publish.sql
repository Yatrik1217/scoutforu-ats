-- Per-job "publish to website" control (Jobitus-style). Jobs no longer appear
-- on the public careers page automatically — each one is published explicitly
-- from the Jobs board.
alter table public.jobs add column if not exists published boolean not null default false;
alter table public.jobs add column if not exists published_at timestamptz;

-- Backfill: everything the careers page showed before this migration (approved,
-- open/hot) stays visible, so the live site doesn't blank out on deploy.
update public.jobs
set published = true, published_at = coalesce(published_at, now())
where approval_status = 'approved' and status in ('open', 'hot') and published = false;
