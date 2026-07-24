-- ScoutforU Finance — a self-contained expense & P&L tracker that lives
-- alongside the ATS but is its own product surface (/finance), visible to the
-- Master Admin only. Tracks two SEPARATE books:
--   * personal — home, petrol, EMIs, everyday spend (owner's own money)
--   * company  — ScoutforU operating expenses
-- Company REVENUE is not stored here: it is read live from placement_payments
-- (money actually collected) so the P&L / EBITDA never needs double entry.
--
-- EBITDA note: categories flagged `ebitda_addback` (Interest, Taxes,
-- Depreciation & Amortisation) are excluded from operating expenses, so
-- EBITDA = Revenue − operating expenses, and Net Profit = EBITDA − those.
--
-- Depends on public.is_admin() (migration 0002) — true only for master_admin.
-- Idempotent: safe to run more than once.

-- ---- categories --------------------------------------------------------------
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('personal','company')),
  name text not null,
  kind text not null default 'expense' check (kind in ('expense','income')),
  color text not null default '#2a6fdb',
  -- true for Interest / Taxes / Depreciation & Amortisation: added back for EBITDA
  ebitda_addback boolean not null default false,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists finance_categories_scope_idx on public.finance_categories (scope);

-- ---- expenses / income lines -------------------------------------------------
-- One row per transaction. `is_income` lets you record miscellaneous income
-- (e.g. an "other income" company line, or personal income) without a whole
-- separate table; the P&L treats income rows as additions, expense rows as
-- subtractions. EMI installment payments are also mirrored here (linked via
-- emi_id) so a paid EMI shows up in the ledger and the P&L automatically.
create table if not exists public.finance_expenses (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('personal','company')),
  category_id uuid references public.finance_categories(id) on delete set null,
  is_income boolean not null default false,
  title text not null default '',
  amount numeric not null default 0,          -- always positive; is_income sets direction
  txn_date date not null default current_date,
  payment_method text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer','upi','cheque','cash','card','auto_debit','other')),
  payee text not null default '',
  notes text not null default '',
  emi_id uuid,                                 -- set when this row is an EMI installment
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_expenses_scope_idx on public.finance_expenses (scope);
create index if not exists finance_expenses_date_idx on public.finance_expenses (txn_date);
create index if not exists finance_expenses_category_idx on public.finance_expenses (category_id);
create index if not exists finance_expenses_emi_idx on public.finance_expenses (emi_id);

-- ---- EMIs / loans ------------------------------------------------------------
-- Recurring loan repayments with a due day each month, a running paid count,
-- and a derived next-due date & outstanding balance. Marking an installment
-- paid advances the schedule and drops an expense line into finance_expenses.
create table if not exists public.finance_emis (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('personal','company')),
  name text not null default '',              -- "Car Loan", "Home Loan", "Office Rent EMI"
  lender text not null default '',
  category_id uuid references public.finance_categories(id) on delete set null,
  principal numeric not null default 0,        -- original loan amount (for reference)
  emi_amount numeric not null default 0,       -- monthly installment
  interest_rate numeric not null default 0,    -- annual %, optional/informational
  total_installments int not null default 0,   -- 0 = open-ended / not tracked
  paid_installments int not null default 0,
  start_date date not null default current_date,
  due_day int not null default 5 check (due_day between 1 and 31),
  next_due_date date,                          -- maintained by the app
  status text not null default 'active' check (status in ('active','paused','closed')),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_emis_scope_idx on public.finance_emis (scope);
create index if not exists finance_emis_due_idx on public.finance_emis (next_due_date);

-- link the mirror expense back to its EMI (added after both tables exist)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'finance_expenses_emi_fk'
  ) then
    alter table public.finance_expenses
      add constraint finance_expenses_emi_fk
      foreign key (emi_id) references public.finance_emis(id) on delete set null;
  end if;
end $$;

-- ---- RLS: Master Admin only (mirrors placements/invoices) ---------------------
alter table public.finance_categories enable row level security;
alter table public.finance_expenses  enable row level security;
alter table public.finance_emis       enable row level security;

drop policy if exists finance_categories_admin on public.finance_categories;
drop policy if exists finance_expenses_admin  on public.finance_expenses;
drop policy if exists finance_emis_admin       on public.finance_emis;

create policy finance_categories_admin on public.finance_categories
  for all using (public.is_admin()) with check (public.is_admin());
create policy finance_expenses_admin on public.finance_expenses
  for all using (public.is_admin()) with check (public.is_admin());
create policy finance_emis_admin on public.finance_emis
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- seed default categories (only on a fresh install) -----------------------
insert into public.finance_categories (scope, name, kind, color, ebitda_addback, sort)
select * from (values
  -- personal
  ('personal','Home',                 'expense','#2a6fdb', false, 10),
  ('personal','Petrol / Fuel',        'expense','#f59e0b', false, 20),
  ('personal','EMIs',                 'expense','#8b5cf6', false, 30),
  ('personal','Groceries',            'expense','#16a34a', false, 40),
  ('personal','Utilities',            'expense','#06b6d4', false, 50),
  ('personal','Food & Dining',        'expense','#e8833a', false, 60),
  ('personal','Health',               'expense','#ef4444', false, 70),
  ('personal','Travel',               'expense','#6366f1', false, 80),
  ('personal','Shopping',             'expense','#ec4899', false, 90),
  ('personal','Other',                'expense','#64748b', false, 100),
  ('personal','Income',               'income', '#16a34a', false, 110),
  -- company (ScoutforU)
  ('company','Salaries & Wages',      'expense','#2a6fdb', false, 10),
  ('company','Office Rent',           'expense','#8b5cf6', false, 20),
  ('company','Software & Tools',      'expense','#06b6d4', false, 30),
  ('company','Job Boards / Sourcing', 'expense','#f59e0b', false, 40),
  ('company','Marketing',             'expense','#ec4899', false, 50),
  ('company','Travel & Conveyance',   'expense','#6366f1', false, 60),
  ('company','Utilities & Internet',  'expense','#10b981', false, 70),
  ('company','Professional Fees',     'expense','#e8833a', false, 80),
  ('company','Bank Charges',          'expense','#94a3b8', false, 90),
  ('company','Other Operating',       'expense','#64748b', false, 100),
  ('company','Other Income',          'income', '#16a34a', false, 110),
  -- company — below-the-EBITDA-line (added back for EBITDA)
  ('company','Interest',              'expense','#b45309', true, 200),
  ('company','Taxes',                 'expense','#7c3aed', true, 210),
  ('company','Depreciation & Amortisation','expense','#475569', true, 220)
) as v(scope, name, kind, color, ebitda_addback, sort)
where not exists (select 1 from public.finance_categories);
