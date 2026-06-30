-- Experience is commonly fractional (e.g. 4.5 years = 4 yrs 6 mo), and the resume
-- parser extracts decimals — so exp_years must accept them.
alter table public.candidates
  alter column exp_years type numeric using exp_years::numeric;
