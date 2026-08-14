-- Public, read-only jobs feed for the scoutforu.com careers page.
--
-- The website (static, hosted on Hostinger) reads this view directly from
-- Supabase with the public anon key. To keep client confidentiality, the view
-- exposes ONLY safe public columns (no client_id, budgets, custom fields or
-- internal flags) and masks the client's name out of the description — the same
-- confidentiality the in-app careers page enforces. Anonymous visitors can read
-- THIS VIEW but never the underlying jobs/clients tables.
--
-- security_invoker = false: the view runs with its owner's rights and is itself
-- the access boundary; anon is granted SELECT on the view only.

create or replace view public.public_jobs
with (security_invoker = false) as
select
  j.id,
  j.title,
  j.dept,
  j.location,
  j.type,
  j.exp_min,
  j.exp_max,
  j.openings,
  j.posted_at,
  case
    when c.name is not null and length(trim(c.name)) > 0
      then replace(j.description, c.name, '—')
    else j.description
  end as description
from public.jobs j
left join public.clients c on c.id = j.client_id
where j.published = true
  and j.approval_status = 'approved'
  and j.status in ('open', 'hot');

-- Expose the curated view to anonymous website visitors; nothing else.
grant select on public.public_jobs to anon, authenticated;
