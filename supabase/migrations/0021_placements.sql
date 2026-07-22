-- ScoutforU Placements — recruitment revenue tracker.
-- Records each hire (candidate, client, joining date, fee) and tracks the
-- payment owed by the client: when it's due (DOJ + credit days), what's been
-- received, the replacement/guarantee window, and an optional link to a
-- generated invoice. Master-Admin-only, like invoices.

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  -- who was placed (optional link to an ATS candidate; name is always stored)
  candidate_id uuid references public.candidates(id) on delete set null,
  candidate_name text not null default '',
  position text not null default '',
  -- client being billed (link + snapshot name)
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null default '',
  job_id uuid references public.jobs(id) on delete set null,
  recruiter_id uuid references public.profiles(id) on delete set null,
  joining_date date not null default current_date,
  -- fee: percent of annual CTC, or a flat amount
  fee_mode text not null default 'percent' check (fee_mode in ('percent','flat')),
  annual_ctc numeric not null default 0,       -- rupees per annum
  fee_percent numeric not null default 8.33,   -- 8.33% = one month's CTC
  fee_amount numeric not null default 0,        -- base fee, pre-GST
  gst_applicable boolean not null default true,
  gst_percent numeric not null default 18,
  gst_amount numeric not null default 0,
  total_fee numeric not null default 0,         -- fee + gst = what the client owes
  -- payment terms & guarantee (both counted from the joining date)
  credit_days int not null default 30,
  due_date date,                                 -- joining_date + credit_days
  replacement_days int not null default 90,
  replacement_until date,                        -- joining_date + replacement_days
  -- tracking
  status text not null default 'pending'
    check (status in ('pending','invoiced','partial','paid','replaced','cancelled','written_off')),
  amount_received numeric not null default 0,
  invoice_id uuid references public.invoices(id) on delete set null,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index placements_status_idx on public.placements (status);
create index placements_client_idx on public.placements (client_id);
create index placements_due_idx on public.placements (due_date);
create index placements_joining_idx on public.placements (joining_date);

-- payments received against a placement
create table public.placement_payments (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  amount numeric not null,
  paid_on date not null default current_date,
  method text not null default 'bank_transfer'
    check (method in ('bank_transfer','upi','cheque','cash','card','other')),
  reference text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index placement_payments_placement_idx on public.placement_payments (placement_id);

-- per-placement activity trail
create table public.placement_events (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  kind text not null default 'note',
  body text not null default '',
  by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index placement_events_placement_idx on public.placement_events (placement_id);

-- ---- RLS: Master Admin only ---------------------------------------------------
alter table public.placements enable row level security;
alter table public.placement_payments enable row level security;
alter table public.placement_events enable row level security;

create policy placements_admin on public.placements
  for all using (public.is_admin()) with check (public.is_admin());
create policy placement_payments_admin on public.placement_payments
  for all using (public.is_admin()) with check (public.is_admin());
create policy placement_events_admin on public.placement_events
  for all using (public.is_admin()) with check (public.is_admin());
