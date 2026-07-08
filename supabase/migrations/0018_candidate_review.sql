-- Internal profile approval: when a recruiter submits a candidate to Screening,
-- an internal approver (profiles.is_approver / master admin) reviews the profile
-- before it can be shared with the client.
alter table public.candidates add column if not exists review_status text not null default 'none'
  check (review_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.candidates add column if not exists reviewed_by uuid references public.profiles (id) on delete set null;
alter table public.candidates add column if not exists reviewed_at timestamptz;
