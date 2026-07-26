-- ScoutforU Finance — recurring "bills" (rent, software subscriptions, salaries…).
-- Adds a fourth commitment type to finance_emis: 'bill'. A bill behaves like an
-- insurance premium — open-ended, monthly, with a due date; paying it posts an
-- expense — but it's labelled as a general recurring operating cost. This lets
-- monthly costs auto-appear in Upcoming payments and be caught up in one click.
-- Idempotent: safe to run more than once.

do $$
begin
  -- widen the type check to include 'bill' (drop the old constraint if present)
  if exists (select 1 from pg_constraint where conname = 'finance_emis_type_check') then
    alter table public.finance_emis drop constraint finance_emis_type_check;
  end if;
  alter table public.finance_emis
    add constraint finance_emis_type_check
    check (type in ('loan','insurance','sip','bill'));
end $$;
