-- Manual "Critical" flag on a role — lets the admin pin a requisition to the top
-- of Weekly Focus regardless of the auto-computed priority score (client
-- escalations, VIP roles, off-system urgency).
alter table jobs
  add column if not exists is_critical boolean not null default false;
