-- Admin-defined custom fields for candidates / jobs / clients.
create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('candidate', 'job', 'client')),
  label text not null,
  field_key text not null,
  type text not null default 'text' check (type in ('text', 'number', 'select')),
  options text[] not null default '{}',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (module, field_key)
);

-- Values are stored as JSON on the entity, keyed by field_key.
alter table public.candidates add column if not exists custom jsonb not null default '{}';
alter table public.jobs add column if not exists custom jsonb not null default '{}';
alter table public.clients add column if not exists custom jsonb not null default '{}';

alter table public.custom_fields enable row level security;
create policy custom_fields_select on public.custom_fields
  for select using (public.is_staff());
create policy custom_fields_staff_write on public.custom_fields
  for all using (public.is_staff()) with check (public.is_staff());
