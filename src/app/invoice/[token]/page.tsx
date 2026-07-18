import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import {
  money,
  amountInWords,
  balanceDue,
  isOverdue,
  STATUS_META,
  orgAddressLine,
} from "@/lib/invoice";
import type {
  InvoiceRow,
  InvoiceItemRow,
  OrganizationRow,
  InvoiceSettingsRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtD = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd MMM yyyy") : "—");

// Public, tokenized invoice view — what the client opens from the email.
export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{24,64}$/.test(token)) notFound();

  const sb = createServiceClient();
  const { data: invData } = await sb
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!invData) notFound();
  const inv = invData as InvoiceRow;

  const [{ data: items }, { data: org }, { data: settings }] = await Promise.all([
    sb.from("invoice_items").select("*").eq("invoice_id", inv.id).order("sort"),
    sb.from("organization").select("*").maybeSingle(),
    sb.from("invoice_settings").select("*").maybeSingle(),
  ]);
  const orgRow = org as OrganizationRow | null;
  const settingsRow = settings as InvoiceSettingsRow | null;

  // First open by the client: sent → viewed (Zoho-style read receipt).
  if (inv.status === "sent") {
    await Promise.all([
      sb
        .from("invoices")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", inv.id),
      sb.from("invoice_events").insert({
        invoice_id: inv.id,
        kind: "viewed",
        body: "Invoice viewed via the public link",
      }),
    ]);
    inv.status = "viewed";
  }

  const od = isOverdue(inv);
  const meta = od ? { label: "Overdue", color: "#dc2626" } : STATUS_META[inv.status];
  const balance = balanceDue(inv);

  return (
    <div className="min-h-screen bg-[#eef1f6] py-8 print:bg-white print:py-0">
      <div className="mx-auto max-w-[760px] px-4">
        {/* toolbar (hidden when printing) */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div className="text-[13px] font-bold text-[#42506b]">
            Invoice from {orgRow?.name || "ScoutforU"}
          </div>
          <a
            href={`/api/invoice/${token}/pdf`}
            className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#245fc0]"
          >
            <Download size={14} /> Download PDF
          </a>
        </div>

        {/* paper */}
        <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white shadow-[0_10px_40px_rgba(20,32,58,.08)] print:rounded-none print:border-0 print:shadow-none">
          <div className="h-[6px] bg-gradient-to-r from-[#2a6fdb] to-[#5b96f0]" />
          <div className="p-[30px_34px]">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {orgRow?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={orgRow.logo_url}
                    alt=""
                    className="h-[48px] w-auto max-w-[150px] shrink-0 object-contain"
                  />
                )}
                <div>
                <div className="text-[20px] font-extrabold text-[#16203a]">
                  {orgRow?.name || "ScoutforU"}
                </div>
                {orgRow?.tagline && <div className="text-[12px] text-[#8a94a6]">{orgRow.tagline}</div>}
                <div className="mt-1.5 text-[11.5px] leading-relaxed text-[#8a94a6]">
                  {orgAddressLine(orgRow?.address, orgRow?.city)}
                  {orgRow?.phone || orgRow?.email ? (
                    <>
                      <br />
                      {[orgRow?.phone, orgRow?.email].filter(Boolean).join(" · ")}
                    </>
                  ) : null}
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
                <div className="text-[16px] font-extrabold tracking-wide text-[#2a6fdb]">
                  TAX INVOICE
                </div>
                <div className="mt-0.5 text-[13.5px] font-extrabold">{inv.invoice_no}</div>
                <span
                  className="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ color: meta.color, background: `${meta.color}1f` }}
                >
                  {meta.label}
                </span>
              </div>
            </div>

            <div className="mt-7 flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                  Bill to
                </div>
                <div className="mt-1 text-[14px] font-extrabold">{inv.bill_to_name}</div>
                {inv.bill_to_address && (
                  <div className="whitespace-pre-line text-[11.5px] text-[#7a8696]">
                    {inv.bill_to_address}
                  </div>
                )}
                {inv.bill_to_gstin && (
                  <div className="mt-0.5 text-[11px] font-bold text-[#42506b]">
                    GSTIN: {inv.bill_to_gstin}
                  </div>
                )}
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
                <span className="text-[#8a94a6]">Invoice date</span>
                <span className="text-right font-bold">{fmtD(inv.issue_date)}</span>
                <span className="text-[#8a94a6]">Due date</span>
                <span className={`text-right font-bold ${od ? "text-[#dc2626]" : ""}`}>
                  {fmtD(inv.due_date)}
                </span>
                <span className="text-[#8a94a6]">Balance due</span>
                <span className="text-right text-[14px] font-extrabold text-[#2a6fdb]">
                  {money(balance)}
                </span>
              </div>
            </div>

            {/* items */}
            <div className="mt-7">
              <div className="grid grid-cols-[28px_1fr_64px_105px_105px] gap-2 rounded-t-[8px] bg-[#16203a] px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <div>#</div>
                <div>Item & description</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Rate</div>
                <div className="text-right">Amount</div>
              </div>
              {((items ?? []) as InvoiceItemRow[]).map((it, i) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[28px_1fr_64px_105px_105px] gap-2 border-b border-[#f0f3f8] px-3 py-3"
                >
                  <div className="text-[12px] text-[#a3acbd]">{i + 1}</div>
                  <div>
                    <div className="text-[12.5px] font-bold text-[#16203a]">{it.description}</div>
                    {it.details && (
                      <div className="text-[11px] leading-snug text-[#8a94a6]">{it.details}</div>
                    )}
                  </div>
                  <div className="text-right text-[12.5px]">{it.qty}</div>
                  <div className="text-right text-[12.5px]">{money(it.rate)}</div>
                  <div className="text-right text-[12.5px] font-extrabold">{money(it.amount)}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start justify-between gap-6">
              <div className="max-w-[280px] pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                  Amount in words
                </div>
                <div className="mt-1 text-[11.5px] italic leading-snug text-[#7a8696]">
                  {amountInWords(inv.total)}
                </div>
              </div>
              <div className="w-[280px] space-y-1.5 text-[12.5px]">
                <PRow label="Subtotal" value={money(inv.subtotal)} />
                {inv.discount_amount > 0 && (
                  <PRow label={`Discount (${inv.discount_percent}%)`} value={`- ${money(inv.discount_amount)}`} />
                )}
                {inv.tax_mode === "cgst_sgst" && inv.tax_amount > 0 && (
                  <>
                    <PRow label={`CGST (${inv.gst_percent / 2}%)`} value={money(inv.tax_amount / 2)} />
                    <PRow label={`SGST (${inv.gst_percent / 2}%)`} value={money(inv.tax_amount / 2)} />
                  </>
                )}
                {inv.tax_mode === "igst" && inv.tax_amount > 0 && (
                  <PRow label={`IGST (${inv.gst_percent}%)`} value={money(inv.tax_amount)} />
                )}
                <div className="flex items-center justify-between rounded-[8px] bg-[#eef4fe] px-3 py-2">
                  <span className="font-extrabold text-[#16203a]">Total</span>
                  <span className="text-[15px] font-extrabold text-[#2a6fdb]">{money(inv.total)}</span>
                </div>
                {inv.amount_paid > 0 && (
                  <>
                    <PRow label="Payments received" value={`- ${money(inv.amount_paid)}`} />
                    <div className="flex items-center justify-between px-3 font-extrabold">
                      <span>Balance due</span>
                      <span>{money(balance)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {(settingsRow?.bank_details || inv.terms || settingsRow?.terms || inv.notes) && (
              <div className="mt-8 grid grid-cols-2 gap-6 border-t border-[#f0f3f8] pt-5">
                {settingsRow?.bank_details && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">
                      Pay via bank transfer
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

        <div className="mt-4 pb-8 text-center text-[11px] font-semibold text-[#a3acbd] print:hidden">
          Powered by ScoutforU Invoices
        </div>
      </div>
    </div>
  );
}

function PRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3">
      <span className="font-semibold text-[#7a8696]">{label}</span>
      <span className="font-bold text-[#16203a]">{value}</span>
    </div>
  );
}
