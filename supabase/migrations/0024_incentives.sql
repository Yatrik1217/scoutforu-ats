-- Recruiter incentives. One scheme for the firm, with an optional per-recruiter
-- percentage override. Incentive is always computed on the BASE FEE (excl GST
-- and before TDS) — you don't pay incentive on tax.

create table if not exists public.incentive_settings (
  id boolean primary key default true,
  -- 'collected' pays only on money actually received; 'booked' pays on the
  -- fee as soon as the candidate joins.
  basis text not null default 'collected' check (basis in ('booked', 'collected')),
  -- 'flat' = one percentage; 'slab' = rate decided by the period total.
  mode text not null default 'flat' check (mode in ('flat', 'slab')),
  flat_percent numeric not null default 5,
  -- [{ "upto": 500000, "percent": 3 }, { "upto": null, "percent": 8 }]
  slabs jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  constraint incentive_settings_singleton check (id)
);
insert into public.incentive_settings (id) values (true) on conflict do nothing;

alter table public.incentive_settings enable row level security;
drop policy if exists incentive_settings_admin on public.incentive_settings;
create policy incentive_settings_admin on public.incentive_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Optional per-recruiter override of the flat percentage.
alter table public.profiles
  add column if not exists incentive_percent numeric;
