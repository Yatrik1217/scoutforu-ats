-- Company / national holidays. A date listed here is a non-working day: it never
-- counts as absent and shows as "Holiday" on the register. Admin manages the list.

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  on_date date not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists holidays_date_idx on public.holidays (on_date);

alter table public.holidays enable row level security;

drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays
  for select using (public.is_staff());

drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays
  for all using (public.is_admin()) with check (public.is_admin());
