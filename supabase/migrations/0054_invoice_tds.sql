-- TDS on invoice payments. Clients withhold TDS (typically 10% of the
-- professional fee, excluding GST) and remit the rest. Track it so an invoice
-- settled with TDS shows as fully paid, the net bank receipt is separated from
-- the TDS credit (advance tax, recoverable — not lost income), and both are
-- reportable per client.
--
--   payment.amount      = money actually received in the bank (net)
--   payment.tds_amount  = TDS the client withheld for that payment
--   invoice.amount_paid = SUM(amount + tds_amount)  -- gross discharged (drives balance/paid)
--   invoice.tds_amount  = SUM(tds_amount)            -- for display / per-client reporting

alter table invoice_payments
  add column if not exists tds_amount numeric not null default 0;

alter table invoices
  add column if not exists tds_amount numeric not null default 0;
