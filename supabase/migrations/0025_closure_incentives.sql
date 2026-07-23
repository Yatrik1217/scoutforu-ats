-- Closure-based incentive plan: per-recruiter quarterly / half-yearly / annual
-- tiers driven by the NUMBER of closures, with eligibility rules (candidate must
-- complete a minimum tenure and the client's invoice must be settled).
-- Periods follow the Indian financial year: Q1 Apr-Jun … Q4 Jan-Mar.

-- Allow the new 'closure' mode alongside flat/slab.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.incentive_settings'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%mode%';
  if c is not null then
    execute format('alter table public.incentive_settings drop constraint %I', c);
  end if;
end $$;

alter table public.incentive_settings
  add constraint incentive_settings_mode_chk check (mode in ('flat', 'slab', 'closure'));

alter table public.incentive_settings
  -- [{ "from":1, "to":2, "per_closure":2000, "bonus":0, "bonus_at":null }, …]
  add column if not exists quarterly_tiers jsonb not null default '[]',
  -- [{ "from":5, "to":6, "bonus":5000 }, …]
  add column if not exists halfyearly_tiers jsonb not null default '[]',
  -- [{ "from":19, "to":null, "bonus":50000, "reward":"Domestic trip for 2" }, …]
  add column if not exists annual_tiers jsonb not null default '[]',
  -- a closure only counts once the candidate has completed this many days …
  add column if not exists min_tenure_days int not null default 30,
  -- … and (optionally) the client's invoice is fully settled.
  add column if not exists require_collected boolean not null default true,
  -- half-yearly bonus needs at least this many closures in EACH quarter
  add column if not exists quarterly_min_target int not null default 2,
  add column if not exists halfyearly_requires_both boolean not null default true;

-- Seed the revised plan (per recruiter) if no tiers have been configured yet.
update public.incentive_settings
   set quarterly_tiers = '[
         {"from":1,"to":2,"per_closure":2000,"bonus":0,"bonus_at":null},
         {"from":3,"to":4,"per_closure":3000,"bonus":3000,"bonus_at":4},
         {"from":5,"to":null,"per_closure":4000,"bonus":6000,"bonus_at":6}
       ]'::jsonb,
       halfyearly_tiers = '[
         {"from":5,"to":6,"bonus":5000},
         {"from":7,"to":9,"bonus":10000},
         {"from":10,"to":null,"bonus":18000}
       ]'::jsonb,
       annual_tiers = '[
         {"from":10,"to":13,"bonus":15000,"reward":""},
         {"from":14,"to":18,"bonus":30000,"reward":""},
         {"from":19,"to":null,"bonus":50000,"reward":"Domestic trip for 2"}
       ]'::jsonb
 where jsonb_array_length(quarterly_tiers) = 0;
