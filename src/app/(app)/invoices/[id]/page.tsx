import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  FilePlus2,
  Send,
  Eye,
  IndianRupee,
  BellRing,
  Ban,
  StickyNote,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  money,
  amountInWords,
  balanceDue,
  isOverdue,
  daysOverdue,
  METHOD_LABEL,
} from "@/lib/invoice";
import { InvoiceStatusBadge } from "@/components/invoice-bits";
import { InvoiceActions, DeletePaymentButton } from "@/components/invoice-actions";
import type {
  InvoiceRow,
  InvoiceItemRow,
  InvoicePaymentRow,
  InvoiceEventRow,
  InvoiceSettingsRow,
  OrganizationRow,
  ProfileRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtD = (d: string | null) =>
  d ? format(new Date(d + "T00:00:00"), "dd MMM yyyy") : "—";

const EVENT_ICON: Record<string, typeof Send> = {
  created: FilePlus2,
  sent: Send,
  reminder: BellRing,
  viewed: Eye,
  payment: IndianRupee,
  status: Ban,
  note: StickyNote,
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const sb = await createClient();
  const [
    { data: invData },
    { data: itemData },
    { data: payData },
    { data: eventData },
    { data: org },
    { data: settings },
    { data: team },
  ] = await Promise.all([
    sb.from("invoices").select("*").eq("id", id).maybeSingle(),
    sb.from("invoice_items").select("*").eq("invoice_id", id).order("sort"),
    sb.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_on", { ascending: false }),
    sb.from("invoice_events").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
    sb.from("organization").select("*").maybeSingle(),
    sb.from("invoice_settings").select("*").maybeSingle(),
    sb.from("profiles").select("id,name"),
  ]);
  if (!invData) notFound();
  const inv = invData as InvoiceRow;
  const items = (itemData ?? []) as InvoiceItemRow[];
  const payments = (payData ?? []) as InvoicePaymentRow[];
  const events = (eventData ?? []) as InvoiceEventRow[];
  const orgRow = org as OrganizationRow | null;
  const settingsRow = settings as InvoiceSettingsRow | null;
  const nameById = new Map((team ?? []).map((p: Pick<ProfileRow, "id" | "name">) => [p.id, p.name]));

  const od = isOverdue(inv);
  const balance = balanceDue(inv);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
              {inv.invoice_no}
            </h1>
            <InvoiceStatusBadge invoice={inv} />
            {od && (
              <span className="text-[12px] font-bold text-[#dc2626]">
                {daysOverdue(inv)} days overdue
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8a94a6]">
            {inv.bill_to_name} · issued {fmtD(inv.issue_date)} · due {fmtD(inv.due_date)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/invoices/all" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
            ← All invoices
          </Link>
        </div>
      </div>

      <InvoiceActions invoice={inv} />

      <div className="mt-[18px] grid grid-cols-[1.6fr_1fr] items-start gap-[18px]">
        {/* invoice paper */}
        <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
          <div className="border-b border-[#eef1f6] p-[26px_28px]">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3.5">
                {orgRow?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={orgRow.logo_url}
                    alt=""
                    className="h-[44px] w-auto max-w-[140px] shrink-0 object-contain"
                  />
                )}
                <div>
                <div className="font-display text-[19px] font-extrabold text-[#16203a]">
                  {orgRow?.name || "ScoutforU"}
                </div>
                {orgRow?.tagline && (
                  <div className="text-[11.5px] text-[#8a94a6]">{orgRow.tagline}</div>
                )}
                <div className="mt-1.5 whitespace-pre-line text-[11.5px] leading-relaxed text-[#8a94a6]">
                  {[orgRow?.address, orgRow?.city].filter(Boolean).join(", ")}
                </div>
                {(settingsRow?.gstin || settingsRow?.pan) && (
                  <div className="mt-1 text-[11px] font-bold text-[#42506b]">
                    {settingsRow?.gstin && <>GSTIN: {settingsRow.gstin} </>}
                    {settingsRow?.pan && <>· PAN: {settingsRow.pan}</>}
                  </div>
                )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-extrabold tracking-wide text-[#2a6fdb]">
                  TAX INVOICE
                </div>
                <div className="mt-1 text-[13px] font-extrabold">{inv.invoice_no}</div>
                <div className="mt-2 text-[11.5px] text-[#8a94a6]">
                  Balance due
                  <div className="tf-num text-[19px] font-extrabold text-[#16203a]">
                    {money(balance)}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                  Bill to
                </div>
                <div className="mt-1 text-[13.5px] font-extrabold">{inv.bill_to_name || "—"}</div>
                {inv.bill_to_address && (
                  <div className="whitespace-pre-line text-[11.5px] text-[#7a8696]">
                    {inv.bill_to_address}
                  </div>
                )}
                {inv.bill_to_email && (
                  <div className="text-[11.5px] text-[#7a8696]">{inv.bill_to_email}</div>
                )}
                {inv.bill_to_gstin && (
                  <div className="mt-0.5 text-[11px] font-bold text-[#42506b]">
                    GSTIN: {inv.bill_to_gstin}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 content-start gap-x-3 gap-y-1.5 text-[12px]">
                <span className="text-[#8a94a6]">Invoice date</span>
                <span className="tf-num text-right font-bold">{fmtD(inv.issue_date)}</span>
                <span className="text-[#8a94a6]">Due date</span>
                <span className={`tf-num text-right font-bold ${od ? "text-[#dc2626]" : ""}`}>
                  {fmtD(inv.due_date)}
                </span>
                <span className="text-[#8a94a6]">Terms</span>
                <span className="text-right font-bold">
                  {inv.payment_terms_days === 0 ? "Due on receipt" : `Net ${inv.payment_terms_days}`}
                </span>
              </div>
            </div>
          </div>

          {/* items */}
          <div className="p-[20px_28px]">
            <div className="grid grid-cols-[28px_1fr_70px_110px_110px] gap-2 rounded-t-[8px] bg-[#16203a] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <div>#</div>
              <div>Item & description</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Amount</div>
            </div>
            {items.map((it, i) => (
              <div
                key={it.id}
                className="grid grid-cols-[28px_1fr_70px_110px_110px] gap-2 border-b border-[#f0f3f8] px-3 py-3"
              >
                <div className="text-[12px] text-[#a3acbd]">{i + 1}</div>
                <div>
                  <div className="text-[12.5px] font-bold text-[#16203a]">{it.description}</div>
                  {it.details && (
                    <div className="text-[11px] leading-snug text-[#8a94a6]">{it.details}</div>
                  )}
                </div>
                <div className="tf-num text-right text-[12.5px]">{it.qty}</div>
                <div className="tf-num text-right text-[12.5px]">{money(it.rate)}</div>
                <div className="tf-num text-right text-[12.5px] font-extrabold">
                  {money(it.amount)}
                </div>
              </div>
            ))}

            <div className="mt-4 flex items-start justify-between gap-6">
              <div className="max-w-[260px] pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                  Amount in words
                </div>
                <div className="mt-1 text-[11.5px] italic leading-snug text-[#7a8696]">
                  {amountInWords(inv.total)}
                </div>
              </div>
              <div className="w-[280px] space-y-1.5 text-[12.5px]">
                <TotalRow label="Subtotal" value={money(inv.subtotal)} />
                {inv.discount_amount > 0 && (
                  <TotalRow
                    label={`Discount (${inv.discount_percent}%)`}
                    value={`- ${money(inv.discount_amount)}`}
                    red
                  />
                )}
                {inv.tax_mode === "cgst_sgst" && inv.tax_amount > 0 && (
                  <>
                    <TotalRow label={`CGST (${inv.gst_percent / 2}%)`} value={money(inv.tax_amount / 2)} />
                    <TotalRow label={`SGST (${inv.gst_percent / 2}%)`} value={money(inv.tax_amount / 2)} />
                  </>
                )}
                {inv.tax_mode === "igst" && inv.tax_amount > 0 && (
                  <TotalRow label={`IGST (${inv.gst_percent}%)`} value={money(inv.tax_amount)} />
                )}
                <div className="flex items-center justify-between rounded-[8px] bg-[#eef4fe] px-3 py-2">
                  <span className="font-extrabold text-[#16203a]">Total</span>
                  <span className="tf-num text-[15px] font-extrabold text-[#2a6fdb]">
                    {money(inv.total)}
                  </span>
                </div>
                {inv.amount_paid > 0 && (
                  <>
                    <TotalRow label="Payments received" value={`- ${money(inv.amount_paid)}`} green />
                    <div className="flex items-center justify-between px-3">
                      <span className="font-extrabold">Balance due</span>
                      <span className="tf-num font-extrabold">{money(balance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {(settingsRow?.bank_details || inv.terms || settingsRow?.terms || inv.notes) && (
              <div className="mt-6 grid grid-cols-2 gap-5 border-t border-[#f0f3f8] pt-4">
                {settingsRow?.bank_details && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                      Bank details
                    </div>
                    <div className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-[#42506b]">
                      {settingsRow.bank_details}
                    </div>
                  </div>
                )}
                <div>
                  {(inv.terms || settingsRow?.terms) && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                        Terms & notes
                      </div>
                      <div className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-[#7a8696]">
                        {inv.terms || settingsRow?.terms}
                      </div>
                    </>
                  )}
                  {inv.notes && (
                    <div className="mt-2 whitespace-pre-line text-[11.5px] italic text-[#7a8696]">
                      {inv.notes}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* right rail: payments + activity */}
        <div className="space-y-[18px]">
          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-extrabold">Payments</div>
              <span className="tf-num rounded-full bg-[#e9f9ef] px-2.5 py-[3px] text-[11.5px] font-bold text-[#16a34a]">
                {money(inv.amount_paid)} received
              </span>
            </div>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0"
              >
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e9f9ef] text-[#16a34a]">
                  <IndianRupee size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="tf-num text-[13px] font-extrabold">{money(p.amount)}</div>
                  <div className="truncate text-[11px] text-[#8a94a6]">
                    {fmtD(p.paid_on)} · {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </div>
                </div>
                <DeletePaymentButton paymentId={p.id} />
              </div>
            ))}
            {payments.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                No payments recorded yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-3 text-[14px] font-extrabold">Activity</div>
            {events.map((e) => {
              const Icon = EVENT_ICON[e.kind] ?? StickyNote;
              return (
                <div key={e.id} className="flex gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0">
                  <div className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#eef4fe] text-[#2a6fdb]">
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-snug text-[#42506b]">{e.body}</div>
                    <div className="mt-0.5 text-[10.5px] font-medium text-[#a3acbd]">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      {e.by_user_id && nameById.get(e.by_user_id)
                        ? ` · ${nameById.get(e.by_user_id)}`
                        : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                No activity yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  red,
  green,
}: {
  label: string;
  value: string;
  red?: boolean;
  green?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3">
      <span className="font-semibold text-[#7a8696]">{label}</span>
      <span
        className={`tf-num font-bold ${red ? "text-[#dc2626]" : green ? "text-[#16a34a]" : "text-[#16203a]"}`}
      >
        {value}
      </span>
    </div>
  );
}
