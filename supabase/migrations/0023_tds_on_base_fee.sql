-- TDS is deducted on the professional fee EXCLUDING GST (CBDT Circular
-- 23/2017), not on the GST-inclusive total. Example: fee 1,29,411 -> TDS
-- 12,941.10, and the client pays (fee + GST) - TDS.
--
-- Fixes the default and recomputes any placements created with the old
-- 'total' basis. Safe to run more than once.

alter table public.placements alter column tds_on set default 'fee';

update public.placements
   set tds_on = 'fee',
       tds_amount = round((fee_amount * tds_percent / 100)::numeric, 2),
       net_payable = round((total_fee - (fee_amount * tds_percent / 100))::numeric, 2)
 where tds_applicable and tds_on = 'total';

-- Placements with no TDS: the client pays the full invoice.
update public.placements
   set tds_amount = 0,
       net_payable = total_fee
 where not tds_applicable;
