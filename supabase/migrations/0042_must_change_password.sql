-- First-login password change.
-- New recruiter/client logins are created by an admin with a temporary password;
-- they must set their own password before they can use the app.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Extend the new-user trigger to honour a must_change_password flag passed in the
-- auth user's metadata (admin sets it to 'true' for the temp-password logins).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role, color, client_id, must_change_password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'recruiter'),
    coalesce(new.raw_user_meta_data ->> 'color', '#2a6fdb'),
    nullif(new.raw_user_meta_data ->> 'client_id', '')::uuid,
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
