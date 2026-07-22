"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { saveInvoice, type InvoiceForm } from "@/lib/actions/invoices";
import {
  computeTotals,
  money,
  addDays,
  TERMS_PRESETS,
  TAX_MODE_LABEL,
  type ItemInput,
} from "@/lib/invoice";
import { NumberInput } from "@/components/number-input";
import type {
  InvoiceRow,
  InvoiceItemRow,
  InvoiceSettingsRow,
  InvoiceTaxMode,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const label = "block text-[12px] font-bold text-[#42506b]";

export type ClientLite = {
  id: string;
  name: string;
  contact_email: string | null;
  address: string;
  city: string;
};

export function InvoiceEditor({
  clients,
  settings,
  invoice,
  items,
}: {
  clients: ClientLite[];
  settings: InvoiceSettingsRow | null;
  invoice?: InvoiceRow;
  items?: InvoiceItemRow[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<InvoiceForm>({
    invoiceNo: invoice?.invoice_no ?? "",
    clientId: invoice?.client_id ?? null,
    billToName: invoice?.bill_to_name ?? "",
    billToEmail: invoice?.bill_to_email ?? "",
    billToAddress: invoice?.bill_to_address ?? "",
    billToGstin: invoice?.bill_to_gstin ?? "",
    issueDate: invoice?.issue_date ?? today,
    paymentTermsDays: invoice?.payment_terms_days ?? 30,
    taxMode: invoice?.tax_mode ?? "cgst_sgst",
    gstPercent: invoice?.gst_percent ?? settings?.gst_percent ?? 18,
    discountPercent: invoice?.discount_percent ?? 0,
    notes: invoice?.notes ?? "",
    terms: invoice?.terms ?? settings?.terms ?? "",
    items: items?.length
      ? items.map((it) => ({
          description: it.description,
          details: it.details,
          qty: it.qty,
          rate: it.rate,
        }))
      : [{ description: "", details: "", qty: 1, rate: 0 }],
  });
  const [pending, start] = useTransition();

  const set = <K extends keyof InvoiceForm>(k: K, v: InvoiceForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setF((p) => ({
      ...p,
      items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    }));

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id) ?? null;
    setF((p) => ({
      ...p,
      clientId: c?.id ?? null,
      billToName: c ? c.name : p.billToName,
      billToEmail: c ? (c.contact_email ?? "") : p.billToEmail,
      billToAddress: c ? [c.address, c.city].filter(Boolean).join(", ") : p.billToAddress,
    }));
  };

  const totals = useMemo(
    () => computeTotals(f.items, f.discountPercent, f.gstPercent, f.taxMode),
    [f.items, f.discountPercent, f.gstPercent, f.taxMode],
  );
  const dueDate = addDays(f.issueDate || today, Math.max(0, f.paymentTermsDays));

  const save = () =>
    start(async () => {
      const res = await saveInvoice(invoice?.id ?? null, f);
      if (res.ok && res.id) {
        toast.success(res.message || "Saved");
        router.push(`/invoices/${res.id}`);
      } else toast.error(res.error || "Failed to save");
    });

  return (
    <div className="mx-auto max-w-[980px]">
      {/* bill-to + meta */}
      <div className="grid grid-cols-[1.2fr_1fr] gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-3 text-[13px] font-extrabold text-[#16203a]">Bill to</div>
          <label className={label}>
            Client
            <select
              value={f.clientId ?? ""}
              onChange={(e) => pickClient(e.target.value)}
              className={field + " mt-1 font-normal"}
            >
              <option value="">— One-off / not in client list —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Name*
              <input
                value={f.billToName}
                onChange={(e) => set("billToName", e.target.value)}
                className={field + " mt-1 font-normal"}
              />
            </label>
            <label className={label}>
              Email
              <input
                value={f.billToEmail}
                onChange={(e) => set("billToEmail", e.target.value)}
                className={field + " mt-1 font-normal"}
                placeholder="billing@client.com"
              />
            </label>
          </div>
          <label className={label + " mt-3"}>
            Billing address
            <textarea
              value={f.billToAddress}
              onChange={(e) => set("billToAddress", e.target.value)}
              rows={2}
              className={field + " mt-1 resize-none font-normal"}
            />
          </label>
          <label className={label + " mt-3"}>
            Client GSTIN
            <input
              value={f.billToGstin}
              onChange={(e) => set("billToGstin", e.target.value)}
              className={field + " mt-1 font-normal"}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <div className="mb-3 text-[13px] font-extrabold text-[#16203a]">Invoice details</div>
          <label className={label}>
            Invoice number
            <input
              value={f.invoiceNo}
              onChange={(e) => set("invoiceNo", e.target.value)}
              placeholder={
                settings
                  ? `Auto — next is ${settings.prefix}${String(settings.next_number).padStart(3, "0")}`
                  : "Auto"
              }
              className={field + " mt-1 font-normal"}
            />
            <span className="mt-1 block text-[10.5px] font-medium text-[#a3acbd]">
              Leave blank to auto-number, or type your own (e.g. SFU011).
            </span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Invoice date
              <input
                type="date"
                value={f.issueDate}
                onChange={(e) => set("issueDate", e.target.value)}
                className={field + " mt-1 font-normal"}
              />
            </label>
            <label className={label}>
              Payment terms
              <select
                value={f.paymentTermsDays}
                onChange={(e) => set("paymentTermsDays", parseInt(e.target.value) || 0)}
                className={field + " mt-1 font-normal"}
              >
                {TERMS_PRESETS.map((t) => (
                  <option key={t.days} value={t.days}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 text-[11.5px] font-semibold text-[#8a94a6]">
            Due date: <span className="font-extrabold text-[#16203a]">{dueDate}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={label}>
              Tax
              <select
                value={f.taxMode}
                onChange={(e) => set("taxMode", e.target.value as InvoiceTaxMode)}
                className={field + " mt-1 font-normal"}
              >
                {(Object.keys(TAX_MODE_LABEL) as InvoiceTaxMode[]).map((k) => (
                  <option key={k} value={k}>
                    {TAX_MODE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              GST %
              <NumberInput
                value={f.gstPercent}
                disabled={f.taxMode === "none"}
                onChange={(n) => set("gstPercent", n)}
                className={field + " mt-1 font-normal disabled:opacity-50"}
              />
            </label>
          </div>
          <label className={label + " mt-3"}>
            Discount % (on subtotal)
            <NumberInput
              value={f.discountPercent}
              onChange={(n) => set("discountPercent", n)}
              className={field + " mt-1 font-normal"}
            />
          </label>
        </div>
      </div>

      {/* line items */}
      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
        <div className="mb-3 text-[13px] font-extrabold text-[#16203a]">Line items</div>
        <div className="mb-1 grid grid-cols-[1fr_90px_130px_120px_34px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Item & description</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Rate (₹)</div>
          <div className="text-right">Amount</div>
          <div />
        </div>
        {f.items.map((it, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_90px_130px_120px_34px] items-start gap-2 border-b border-[#f4f6fa] py-2 last:border-0"
          >
            <div>
              <input
                value={it.description}
                onChange={(e) => setItem(i, { description: e.target.value })}
                placeholder="e.g. Recruitment fee — Senior Engineer placement"
                className={field}
              />
              <input
                value={it.details}
                onChange={(e) => setItem(i, { details: e.target.value })}
                placeholder="Details (candidate, joining date, % of CTC…) — optional"
                className={field + " mt-1.5 text-[12px] text-[#7a8696]"}
              />
            </div>
            <NumberInput
              value={it.qty}
              onChange={(n) => setItem(i, { qty: n })}
              className={field + " text-right"}
              title="Qty"
            />
            <NumberInput
              value={it.rate}
              onChange={(n) => setItem(i, { rate: n })}
              className={field + " text-right"}
              title="Rate ₹"
            />
            <div className="tf-num pt-2 text-right text-[13px] font-extrabold text-[#16203a]">
              {money((it.qty || 0) * (it.rate || 0))}
            </div>
            <button
              onClick={() =>
                setF((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))
              }
              disabled={f.items.length === 1}
              className="mt-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-[#c2cad8] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-30"
              title="Remove line"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setF((p) => ({
              ...p,
              items: [...p.items, { description: "", details: "", qty: 1, rate: 0 }],
            }))
          }
          className="mt-3 flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-2 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
        >
          <Plus size={14} /> Add line item
        </button>

        {/* totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-[300px] space-y-1.5 rounded-[12px] bg-[#f8fafc] p-4 text-[13px]">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.discount > 0 && (
              <Row
                label={`Discount (${f.discountPercent}%)`}
                value={`- ${money(totals.discount)}`}
                red
              />
            )}
            {f.taxMode === "cgst_sgst" && totals.tax > 0 && (
              <>
                <Row label={`CGST (${f.gstPercent / 2}%)`} value={money(totals.tax / 2)} />
                <Row label={`SGST (${f.gstPercent / 2}%)`} value={money(totals.tax / 2)} />
              </>
            )}
            {f.taxMode === "igst" && totals.tax > 0 && (
              <Row label={`IGST (${f.gstPercent}%)`} value={money(totals.tax)} />
            )}
            <div className="flex items-center justify-between border-t border-[#e3e8f0] pt-2">
              <span className="text-[13.5px] font-extrabold text-[#16203a]">Total</span>
              <span className="tf-num text-[17px] font-extrabold text-[#2a6fdb]">
                {money(totals.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* notes + terms */}
      <div className="mt-[18px] grid grid-cols-2 gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <label className={label}>
            Notes (shown on the invoice)
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className={field + " mt-1 resize-none font-normal"}
              placeholder="Thank you for your business!"
            />
          </label>
        </div>
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
          <label className={label}>
            Terms (defaults from Invoice Settings)
            <textarea
              value={f.terms}
              onChange={(e) => set("terms", e.target.value)}
              rows={3}
              className={field + " mt-1 resize-none font-normal"}
            />
          </label>
        </div>
      </div>

      {/* actions */}
      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-bold text-[#8a94a6] hover:bg-[#eef1f6]"
        >
          <ArrowLeft size={14} /> Cancel
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Save size={15} />
          {pending ? "Saving…" : invoice ? "Save changes" : "Save invoice"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-[#7a8696]">{label}</span>
      <span className={`tf-num font-bold ${red ? "text-[#dc2626]" : "text-[#16203a]"}`}>
        {value}
      </span>
    </div>
  );
}
