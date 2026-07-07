-- Organization profile (single row) used across the ATS + the public careers page.
create table public.organization (
  id boolean primary key default true,
  name text not null default '',
  tagline text not null default '',
  logo_url text not null default '',
  address text not null default '',
  city text not null default '',
  gst text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  updated_at timestamptz not null default now(),
  constraint organization_singleton check (id)
);
insert into public.organization (id) values (true) on conflict do nothing;

-- Branches / units / divisions.
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  address text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.jobs add column if not exists branch_id uuid references public.branches (id) on delete set null;

alter table public.organization enable row level security;
create policy organization_select on public.organization
  for select using (public.is_staff());
create policy organization_admin_write on public.organization
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.branches enable row level security;
create policy branches_select on public.branches
  for select using (public.is_staff());
create policy branches_staff_write on public.branches
  for all using (public.is_staff()) with check (public.is_staff());
