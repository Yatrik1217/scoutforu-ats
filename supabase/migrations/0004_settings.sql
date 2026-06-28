-- App-wide settings (Admin → Settings toggles). Single row.
create table public.app_settings (
  id boolean primary key default true check (id),
  email_notif boolean not null default true,
  auto_reject boolean not null default false,
  client_portal boolean not null default true,
  two_factor boolean not null default true
);

insert into public.app_settings (id) values (true);

alter table public.app_settings enable row level security;

create policy app_settings_select on public.app_settings
  for select using (auth.uid() is not null);
create policy app_settings_admin_write on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());
