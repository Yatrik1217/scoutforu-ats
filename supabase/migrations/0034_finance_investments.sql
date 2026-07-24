-- ScoutforU Finance — recurring commitments get a TYPE, and investments arrive.
-- The finance_emis table now covers three kinds of monthly commitment:
--   * loan      — has a principal to pay off (outstanding / EMIs remaining).
--   * insurance — a recurring premium (Eterm etc.). It is an EXPENSE: paying it
--                 posts an expense line, but it is NOT a loan (no outstanding).
--   * sip       — an INVESTMENT (SIP / RD / recurring investment). Paying it does
--                 NOT post an expense — it grows an asset. We track amount
--                 invested vs current value to show gain/loss.
--
-- Also: next_due_date is now calendar-anchored (the next occurrence of due_day
-- on/after today), so it never drifts into the past or skips a month.
-- Idempotent: safe to run more than once.

alter table public.finance_emis
  add column if not exists type text not null default 'loan'
    check (type in ('loan','insurance','sip'));
alter table public.finance_emis
  add column if not exists current_value numeric not null default 0;  -- SIP: latest market value

create index if not exists finance_emis_type_idx on public.finance_emis (type);

-- One-time fix: recompute next_due_date for every active commitment to the next
-- occurrence of its due_day on/after today (repairs rows created with the old
-- start_date+installments formula, which drifted). Deterministic — safe to
-- re-run. (Day is clamped to the month length for short months.)
update public.finance_emis e
set next_due_date = (
  case
    when (date_trunc('month', current_date)
          + (least(e.due_day, extract(day from (date_trunc('month', current_date)
              + interval '1 month - 1 day'))::int) - 1) * interval '1 day')::date >= current_date
    then (date_trunc('month', current_date)
          + (least(e.due_day, extract(day from (date_trunc('month', current_date)
              + interval '1 month - 1 day'))::int) - 1) * interval '1 day')::date
    else (date_trunc('month', current_date) + interval '1 month'
          + (least(e.due_day, extract(day from (date_trunc('month', current_date)
              + interval '2 month - 1 day'))::int) - 1) * interval '1 day')::date
  end)
where e.status = 'active';
