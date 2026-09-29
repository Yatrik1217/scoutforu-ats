-- Incentive payout ledger: records the money actually handed to a recruiter
-- against their earned incentive. Each payout can be tagged to a specific
-- placement (candidate) so a per-candidate tally is possible, or left general
-- (an advance / round-off). The incentive statement stays the "earned" side;
-- this table is the "paid" side. Earned − Paid = Balance still to pay.

create table if not exists public.incentive_payouts (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  placement_id uuid references public.placements(id) on delete set null,
  amount numeric not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer','upi','cheque','cash','card','other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists incentive_payouts_recruiter_idx
  on public.incentive_payouts (recruiter_id);
create index if not exists incentive_payouts_placement_idx
  on public.incentive_payouts (placement_id);

-- Master Admin only (mirrors placement_payments).
alter table public.incentive_payouts enable row level security;

drop policy if exists incentive_payouts_admin on public.incentive_payouts;
create policy incentive_payouts_admin on public.incentive_payouts
  for all using (public.is_admin()) with check (public.is_admin());
