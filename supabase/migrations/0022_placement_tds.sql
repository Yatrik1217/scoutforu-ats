-- TDS (Tax Deducted at Source) on placements. Indian clients deduct TDS
-- (typically 10% u/s 194J for recruitment/professional fees) before paying.
-- We track the TDS and the NET amount the client actually credits to the bank,
-- so "balance due" reflects the real cash still to come.

alter table public.placements
  add column if not exists tds_applicable boolean not null default true,
  add column if not exists tds_percent numeric not null default 10,
  add column if not exists tds_on text not null default 'total',
  add column if not exists tds_amount numeric not null default 0,
  add column if not exists net_payable numeric not null default 0;

-- 'total' = TDS on the GST-inclusive invoice; 'fee' = TDS on the fee excl GST.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'placements_tds_on_chk'
  ) then
    alter table public.placements
      add constraint placements_tds_on_chk check (tds_on in ('fee', 'total'));
  end if;
end $$;

-- Backfill existing placements: 10% TDS on the total, net = total - TDS.
update public.placements
   set tds_amount = round((total_fee * tds_percent / 100)::numeric, 2),
       net_payable = round((total_fee - (total_fee * tds_percent / 100))::numeric, 2)
 where net_payable = 0 and total_fee > 0;
