-- One-off payments (salaries, credit-card bills, ad-hoc bills) are entered as
-- finance_expenses rows and show in "Upcoming payments" while their date is
-- today or in the future. Until now there was no way to tick a single one off as
-- paid. `paid_on` records when it was marked paid; a non-null value drops it from
-- the Upcoming/due list. It does NOT change the ledger or P&L — the expense is
-- still a real transaction. NULL = still shows as due (the default, so existing
-- rows are unaffected; past-dated rows are out of the upcoming window anyway).

alter table public.finance_expenses
  add column if not exists paid_on date;

comment on column public.finance_expenses.paid_on is
  'When this one-off payment was marked paid. NULL = still shows as upcoming/due.';
