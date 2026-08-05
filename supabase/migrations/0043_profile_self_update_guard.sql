-- Harden profile self-updates.
-- The profiles_update RLS policy allows a user to update their own row
-- (id = auth.uid()). RLS can't restrict *which columns* change, so without this
-- guard a non-admin could call the API directly and escalate their own role to
-- master_admin, reactivate a deactivated account, or grant themselves approver/
-- incentive rights. This trigger freezes those privileged columns for anyone who
-- is not an admin — regardless of how the update is issued.

create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admins (master_admin) may change anything. The service role bypasses RLS and
  -- runs with no auth.uid() (null) — admin-driven server flows must stay allowed.
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;

  -- For everyone else, privileged fields must stay exactly as they were.
  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.is_approver is distinct from old.is_approver
     or new.incentive_percent is distinct from old.incentive_percent
     or new.client_id is distinct from old.client_id then
    raise exception 'Not allowed to change privileged profile fields';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();
