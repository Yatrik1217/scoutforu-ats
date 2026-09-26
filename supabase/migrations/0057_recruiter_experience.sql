-- Recruiter's own years of experience — used to align roles by seniority:
-- a senior JD (high required experience) is suggested to the more experienced
-- recruiter, a junior JD to the junior one, while balancing load.
alter table profiles
  add column if not exists experience_years numeric not null default 0;
