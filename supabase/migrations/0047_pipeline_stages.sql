-- ============================================================================
-- 0047_pipeline_stages.sql
-- Editable, per-client recruitment pipelines.
--
-- Until now the 9-stage pipeline was a fixed Postgres enum (`candidate_stage`)
-- plus a hardcoded list in the app. This migration makes stages DATA:
--   * a `pipeline_stages` table — an ordered, editable set of stages;
--   * client_id IS NULL  => the shared DEFAULT pipeline (every client uses it);
--   * client_id = <a client> => that client's OVERRIDE (used instead of default).
-- Each stage carries an `outcome` (in_progress | won | lost) so analytics,
-- time-to-hire and close logic still understand what a *custom* stage means.
--
-- `candidates.stage` and `stage_events.from/to_stage` move from the enum to
-- TEXT so they can hold custom slugs. Existing rows are preserved verbatim
-- (the cast is value-for-value). The old enum type is left in place, unused,
-- to avoid breaking anything that might still reference it.
-- ============================================================================

-- ---------- 1. the stages table ----------
create table if not exists public.pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid references public.clients (id) on delete cascade,  -- null = Default
  name       text not null,
  slug       text not null,
  position   int  not null,
  color      text not null default '#64748b',
  outcome    text not null default 'in_progress'
             check (outcome in ('in_progress', 'won', 'lost')),
  created_at timestamptz not null default now()
);

-- Slugs are unique within a pipeline. Two partial indexes so the Default set
-- (client_id null) and each client's set are independently unique.
create unique index if not exists uq_pipeline_stage_default_slug
  on public.pipeline_stages (slug) where client_id is null;
create unique index if not exists uq_pipeline_stage_client_slug
  on public.pipeline_stages (client_id, slug) where client_id is not null;
create index if not exists idx_pipeline_stages_client_pos
  on public.pipeline_stages (client_id, position);

-- ---------- 2. seed the DEFAULT pipeline (mirrors the old enum order) ----------
insert into public.pipeline_stages (client_id, name, slug, position, color, outcome)
values
  (null, 'Sourced',             'sourced',             0, '#64748b', 'in_progress'),
  (null, 'Screening',           'screening',           1, '#2a6fdb', 'in_progress'),
  (null, 'Interview',           'interview',           2, '#6366f1', 'in_progress'),
  (null, 'Practical Interview', 'practical_interview', 3, '#8b5cf6', 'in_progress'),
  (null, 'Selected',            'selected',            4, '#06b6d4', 'in_progress'),
  (null, 'Offered',             'offered',             5, '#f59e0b', 'in_progress'),
  (null, 'Offer Accepted',      'offer_accepted',      6, '#10b981', 'in_progress'),
  (null, 'Joined',              'joined',              7, '#16a34a', 'won'),
  (null, 'Not Joined',          'not_joined',          8, '#ef4444', 'lost')
on conflict do nothing;

-- ---------- 3. candidates.stage: enum -> text (values preserved) ----------
alter table public.candidates alter column stage drop default;
alter table public.candidates alter column stage type text using stage::text;
alter table public.candidates alter column stage set default 'sourced';

-- ---------- 4. stage_events: enum -> text (values preserved) ----------
alter table public.stage_events alter column to_stage   type text using to_stage::text;
alter table public.stage_events alter column from_stage type text using from_stage::text;

-- Note: the `candidate_stage` enum type is intentionally left in place (unused).
-- The stage-change triggers (touch_entered_stage, log_stage_event,
-- handle_offer_stage) compare stage values as text and continue to work; the
-- offer auto-create still keys off the default 'offered'/'offer_accepted'
-- slugs, which the Default pipeline keeps.

-- ---------- 5. RLS: staff read, admins manage (mirrors settings tables) ----------
alter table public.pipeline_stages enable row level security;

create policy pipeline_stages_select on public.pipeline_stages
  for select using (public.is_staff());
create policy pipeline_stages_admin_write on public.pipeline_stages
  for all using (public.is_admin()) with check (public.is_admin());
