-- Link a finance expense back to the payroll run it was auto-posted from, so
-- marking a run Paid writes the ACTUAL salary total into the company P&L's
-- "Salaries & Wages" line (and updating/undoing the run keeps it in sync),
-- without ever creating a duplicate.

alter table public.finance_expenses
  add column if not exists payroll_run_id uuid
    references public.payroll_runs(id) on delete set null;

create index if not exists finance_expenses_payroll_run_idx
  on public.finance_expenses (payroll_run_id);
