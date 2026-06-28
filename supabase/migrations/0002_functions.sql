-- ScoutforU ATS — functions & triggers.

-- ===== auth helpers (SECURITY DEFINER avoids RLS recursion in policies) =====
create or replace function public.auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.auth_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'master_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- staff = master_admin or recruiter (full read across clients)
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('master_admin', 'recruiter') from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Row scope checks used by RLS. SECURITY DEFINER so the inner lookups don't
-- recurse through the calling user's RLS policies.
create or replace function public.job_in_scope(j uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1 from public.jobs
      where id = j and client_id = public.auth_client_id()
    );
$$;

create or replace function public.candidate_in_scope(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
      from public.candidates ca
      join public.jobs jb on jb.id = ca.job_id
      where ca.id = c and jb.client_id = public.auth_client_id()
    );
$$;

-- ===== auto-provision a profile when an auth user is created =====
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, role, color, client_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'recruiter'),
    coalesce(new.raw_user_meta_data ->> 'color', '#2a6fdb'),
    nullif(new.raw_user_meta_data ->> 'client_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ===== reset entered_stage_at when a candidate's stage changes =====
create or replace function public.touch_entered_stage()
returns trigger language plpgsql as $$
begin
  if (new.stage is distinct from old.stage) then
    new.entered_stage_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_entered_stage on public.candidates;
create trigger trg_touch_entered_stage
before update on public.candidates
for each row execute function public.touch_entered_stage();

-- ===== log every stage change as a stage_event =====
-- INSERT logs the initial entry (backdated to entered_stage_at so seeded
-- history reflects real timing); UPDATE logs transitions. by_user_id = actor.
create or replace function public.log_stage_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.stage_events (candidate_id, from_stage, to_stage, by_user_id, created_at)
    values (new.id, null, new.stage, auth.uid(), new.entered_stage_at);
  elsif (new.stage is distinct from old.stage) then
    insert into public.stage_events (candidate_id, from_stage, to_stage, by_user_id)
    values (new.id, old.stage, new.stage, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_stage_event on public.candidates;
create trigger trg_log_stage_event
after insert or update on public.candidates
for each row execute function public.log_stage_event();

-- ===== keep offers in sync with the candidate's stage =====
create or replace function public.handle_offer_stage()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'UPDATE' and new.stage = 'offered' and old.stage is distinct from 'offered') then
    insert into public.offers (candidate_id, salary_lpa, sent_at, expires_at, status)
    values (new.id, new.salary_lpa, now(), now() + interval '7 days', 'pending')
    on conflict (candidate_id)
    do update set salary_lpa = excluded.salary_lpa, sent_at = now(),
                  expires_at = now() + interval '7 days', status = 'pending';
  elsif (tg_op = 'UPDATE' and new.stage = 'offer_accepted' and old.stage is distinct from 'offer_accepted') then
    update public.offers set status = 'accepted' where candidate_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_offer_stage on public.candidates;
create trigger trg_handle_offer_stage
after update on public.candidates
for each row execute function public.handle_offer_stage();
