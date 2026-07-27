-- ScoutforU Finance — live NAV sync for SIPs / investments.
-- Links a SIP to its AMFI mutual-fund scheme and stores the units held, so the
-- app can value it live: current value = units × latest NAV, and today's change
-- = units × (latest NAV − previous NAV). NAVs are pulled daily from AMFI (via
-- api.mfapi.in) at render time; only the scheme code + units live in the DB.
-- Idempotent: safe to run more than once.

alter table public.finance_emis add column if not exists scheme_code text;      -- AMFI scheme code
alter table public.finance_emis add column if not exists units numeric not null default 0; -- units held
