-- OPTIONAL sample data for the Finance module, so the dashboard shows numbers
-- on day one. Run AFTER 0033_finance.sql. Only seeds when the tables are empty,
-- so it never stacks on top of your real entries. Safe to delete these rows
-- later (they have notes = 'sample data').
--
-- To wipe just the samples:
--   delete from public.finance_expenses where notes = 'sample data';
--   delete from public.finance_emis      where notes = 'sample data';

-- ---- sample expenses & income (only if none exist yet) -----------------------
insert into public.finance_expenses
  (scope, category_id, is_income, title, amount, txn_date, payment_method, payee, notes)
select v.scope, c.id, v.is_income, v.title, v.amount, v.txn_date, v.method, v.payee, 'sample data'
from (values
  -- personal
  ('personal','Home',          false, 'House rent',            18000, current_date - 4,  'bank_transfer','Landlord'),
  ('personal','Petrol / Fuel', false, 'Petrol — HP pump',       2500, current_date - 2,  'upi',          'HP'),
  ('personal','Groceries',     false, 'Monthly groceries',      4200, current_date - 6,  'card',         'DMart'),
  ('personal','Utilities',     false, 'Electricity bill',       1600, current_date - 1,  'auto_debit',   'MSEB'),
  -- company (ScoutforU)
  ('company','Salaries & Wages', false, 'Team salaries',       120000, current_date - 3,  'bank_transfer','Payroll'),
  ('company','Office Rent',      false, 'Office rent',           35000, current_date - 3,  'bank_transfer','Landlord'),
  ('company','Software & Tools', false, 'Naukri + tools',         6000, current_date - 5,  'card',         'Vendors'),
  ('company','Marketing',        false, 'LinkedIn ads',           8000, current_date - 7,  'card',         'LinkedIn'),
  ('company','Interest',         false, 'Loan interest',          5000, current_date - 8,  'auto_debit',   'Bank'),
  ('company','Other Income',     true,  'Consulting income',    250000, current_date - 10, 'bank_transfer','Client')
) as v(scope, catname, is_income, title, amount, txn_date, method, payee)
left join public.finance_categories c on c.scope = v.scope and c.name = v.catname
where not exists (select 1 from public.finance_expenses);

-- ---- one sample EMI (only if none exist yet) ---------------------------------
insert into public.finance_emis
  (scope, category_id, name, lender, principal, emi_amount, interest_rate,
   total_installments, paid_installments, start_date, due_day, next_due_date, status, notes)
select 'personal', c.id, 'Car Loan', 'HDFC Bank', 750000, 15000, 9.5,
       60, 12, current_date - interval '12 months',
       5,
       case when extract(day from current_date) <= 5
            then (date_trunc('month', current_date) + interval '4 days')::date
            else (date_trunc('month', current_date) + interval '1 month 4 days')::date
       end,
       'active', 'sample data'
from (select id from public.finance_categories
      where scope = 'personal' and name = 'EMIs' limit 1) c
where not exists (select 1 from public.finance_emis);
