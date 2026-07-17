-- ScoutforU Invoices — full invoicing module (Zoho-Invoice-style).
-- Invoices with line items, GST, payments, recurring profiles and an
-- activity trail. Billing is Master-Admin-only (is_admin() RLS).

-- ---- invoices -------------------------------------------------------------
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  -- Bill-to is denormalized so a sent invoice never changes retroactively.
  bill_to_name text not null default '',
  bill_to_email text not null default '',
  bill_to_address text not null default '',
  bill_to_gstin text not null default '',
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','partial','paid','void','written_off')),
  issue_date date not null default current_date,
  due_date date,
  payment_terms_days int not null default 30,
  -- Tax: 'cgst_sgst' splits gst_percent in half each (intra-state),
  -- 'igst' charges it whole (inter-state), 'none' = no tax.
  tax_mode text not null default 'cgst_sgst' check (tax_mode in ('cgst_sgst','igst','none')),
  gst_percent numeric not null default 18,
  discount_percent numeric not null default 0,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  notes text not null default '',
  terms text not null default '',
  public_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  recurring_id uuid,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_status_idx on public.invoices (status);
create index invoices_client_idx on public.invoices (client_id);
create index invoices_due_idx on public.invoices (due_date);

-- ---- line items -------------------------------------------------------------
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null default '',
  details text not null default '',
  qty numeric not null default 1,
  rate numeric not null default 0,
  amount numeric not null default 0,
  sort int not null default 0
);
create index invoice_items_invoice_idx on public.invoice_items (invoice_id);

-- ---- payments received -------------------------------------------------------
create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null,
  paid_on date not null default current_date,
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer','upi','cheque','cash','card','other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invoice_payments_invoice_idx on public.invoice_payments (invoice_id);

-- ---- recurring profiles (future/repeat billing) ------------------------------
create table public.invoice_recurring (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  client_id uuid references public.clients(id) on delete cascade,
  frequency text not null default 'monthly'
    check (frequency in ('weekly','monthly','quarterly','half_yearly','yearly')),
  next_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  -- item template: [{description, details, qty, rate}]
  items jsonb not null default '[]',
  tax_mode text not null default 'cgst_sgst' check (tax_mode in ('cgst_sgst','igst','none')),
  gst_percent numeric not null default 18,
  discount_percent numeric not null default 0,
  payment_terms_days int not null default 30,
  notes text not null default '',
  terms text not null default '',
  last_generated_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invoices
  add constraint invoices_recurring_fk
  foreign key (recurring_id) references public.invoice_recurring(id) on delete set null;

-- ---- per-invoice activity trail ---------------------------------------------
create table public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  kind text not null default 'note',
  body text not null default '',
  by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invoice_events_invoice_idx on public.invoice_events (invoice_id);

-- ---- RLS: Master Admin only (public link uses the service role) ---------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.invoice_recurring enable row level security;
alter table public.invoice_events enable row level security;

create policy invoices_admin on public.invoices
  for all using (public.is_admin()) with check (public.is_admin());
create policy invoice_items_admin on public.invoice_items
  for all using (public.is_admin()) with check (public.is_admin());
create policy invoice_payments_admin on public.invoice_payments
  for all using (public.is_admin()) with check (public.is_admin());
create policy invoice_recurring_admin on public.invoice_recurring
  for all using (public.is_admin()) with check (public.is_admin());
create policy invoice_events_admin on public.invoice_events
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- atomic invoice numbering (INV-0001, INV-0002, …) --------------------------
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  p text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can number invoices';
  end if;
  update public.invoice_settings
     set next_number = next_number + 1, updated_at = now()
   where id = true
   returning next_number - 1, prefix into n, p;
  return p || lpad(n::text, 4, '0');
end;
$$;
