-- Invoice numbers use 3-digit padding (SFU011 style) to match the existing
-- manual series. Safe to run whether or not 0019 was already applied after
-- it — this only replaces the numbering function.
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  p text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can number invoices';
  end if;
  update public.invoice_settings
     set next_number = next_number + 1, updated_at = now()
   where id = true
   returning next_number - 1, prefix into n, p;
  return p || lpad(n::text, 3, '0');
end;
$$;
