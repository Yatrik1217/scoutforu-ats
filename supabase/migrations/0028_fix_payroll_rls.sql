-- Fix: "infinite recursion detected in policy for relation payroll_runs".
--
-- payroll_runs_self_read checked payroll_lines, and payroll_lines_self_read
-- checks payroll_runs — Postgres bounced between the two policies forever.
--
-- The run header holds no salary data (just month + status), so staff can read
-- any non-draft run and the cycle disappears. Payslip amounts stay protected by
-- the payroll_lines policy, which is the one that matters.

drop policy if exists payroll_runs_self_read on public.payroll_runs;
create policy payroll_runs_self_read on public.payroll_runs
  for select using (status <> 'draft');
