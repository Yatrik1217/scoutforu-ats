"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Zap, X, Save, Repeat } from "lucide-react";
import { toast } from "sonner";
import {
  saveRecurring,
  toggleRecurring,
  deleteRecurring,
  generateRecurringNow,
  type RecurringForm,
} from "@/lib/actions/invoices";
import {
  computeTotals,
  money,
  FREQ_LABEL,
  TAX_MODE_LABEL,
  TERMS_PRESETS,
  type ItemInput,
} from "@/lib/invoice";
import { NumberInput } from "@/components/number-input";
import type {
  InvoiceRecurringRow,
  InvoiceSettingsRow,
  InvoiceTaxMode,
  RecurringFrequency,
} from "@/lib/database.types";

type ClientLite = {
  id: string;
  name: string;
  contact_email: string | null;
  address: string;
  city: string;
};

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function RecurringManager({
  profiles,
  clients,
  settings,
}: {
  profiles: InvoiceRecurringRow[];
  clients: ClientLite[];
  settings: InvoiceSettingsRow | null;
}) {
  const [editing, setEditing] = useState<InvoiceRecurringRow | null | "new">(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message || "Done");
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0]"
        >
          <Plus size={15} /> New recurring profile
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.4fr_1fr_110px_110px_120px_100px_150px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Profile</div>
          <div>Client</div>
          <div>Repeats</div>
          <div>Next invoice</div>
          <div className="text-right">Amount</div>
          <div className="text-center">Active</div>
          <div className="text-right">Actions</div>
        </div>
        {profiles.map((p) => {
          const client = clients.find((c) => c.id === p.client_id);
          const total = computeTotals(p.items, p.discount_percent, p.gst_percent, p.tax_mode).total;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[1.4fr_1fr_110px_110px_120px_100px_150px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#f3eefe] text-[#8b5cf6]">
                  <Repeat size={14} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-[#16203a]">{p.name}</div>
                  <div className="text-[10.5px] text-[#a3acbd]">
                    {p.items.length} line item{p.items.length === 1 ? "" : "s"}
                    {p.end_date ? ` · ends ${p.end_date}` : ""}
                  </div>
                </div>
              </div>
              <div className="truncate text-[12.5px] font-semibold text-[#42506b]">
                {client?.name ?? "—"}
              </div>
              <div className="text-[12px] font-bold text-[#8b5cf6]">{FREQ_LABEL[p.frequency]}</div>
              <div className="tf-num text-[12px] font-semibold">{p.next_date}</div>
              <div className="tf-num text-right text-[13px] font-extrabold">{money(total)}</div>
              <div className="text-center">
                <input
                  type="checkbox"
                  checked={p.active}
                  disabled={pending}
                  onChange={(e) => run(() => toggleRecurring(p.id, e.target.checked))}
                  className="h-4 w-4 accent-[#2a6fdb]"
                />
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => run(() => generateRecurringNow(p.id))}
                  disabled={pending}
                  title="Generate a draft invoice now"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#e8833a] hover:bg-[#fff7ed]"
                >
                  <Zap size={14} />
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a94a6] hover:bg-[#f1f4f9]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete recurring profile “${p.name}”?`))
                      run(() => deleteRecurring(p.id));
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2cad8] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {profiles.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No recurring profiles yet — great for monthly retainers.
          </div>
        )}
      </div>

      {editing !== null && (
        <RecurringModal
          profile={editing === "new" ? null : editing}
          clients={clients}
          settings={settings}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function RecurringModal({
  profile,
  clients,
  settings,
  onClose,
}: {
  profile: InvoiceRecurringRow | null;
  clients: ClientLite[];
  settings: InvoiceSettingsRow | null;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<RecurringForm>({
    name: profile?.name ?? "",
    clientId: profile?.client_id ?? null,
    frequency: profile?.frequency ?? "monthly",
    nextDate: profile?.next_date ?? today,
    endDate: profile?.end_date ?? null,
    items: profile?.items?.length
      ? profile.items
      : [{ description: "", details: "", qty: 1, rate: 0 }],
    taxMode: profile?.tax_mode ?? "cgst_sgst",
    gstPercent: profile?.gst_percent ?? settings?.gst_percent ?? 18,
    discountPercent: profile?.discount_percent ?? 0,
    paymentTermsDays: profile?.payment_terms_days ?? 30,
    notes: profile?.notes ?? "",
    terms: profile?.terms ?? "",
  });
  const [pending, start] = useTransition();
  const router = useRouter();

  const set = <K extends keyof RecurringForm>(k: K, v: RecurringForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));
  const setItem = (i: number, patch: Partial<ItemInput>) =>
    setF((p) => ({ ...p, items: p.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));

  const total = useMemo(
    () => computeTotals(f.items, f.discountPercent, f.gstPercent, f.taxMode).total,
    [f.items, f.discountPercent, f.gstPercent, f.taxMode],
  );

  const save = () =>
    start(async () => {
      const res = await saveRecurring(profile?.id ?? null, f);
      if (res.ok) {
        toast.success(res.message || "Saved");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">
            {profile ? "Edit recurring profile" : "New recurring profile"}
          </h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>
              Profile name <span className="text-[#dc2626]">*</span>
              <input
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Acme monthly retainer"
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              Client <span className="text-[#dc2626]">*</span>
              <select
                value={f.clientId ?? ""}
                onChange={(e) => set("clientId", e.target.value || null)}
                className={input + " mt-1 font-normal"}
              >
                <option value="">— Select client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Repeats
              <select
                value={f.frequency}
                onChange={(e) => set("frequency", e.target.value as RecurringFrequency)}
                className={input + " mt-1 font-normal"}
              >
                {(Object.keys(FREQ_LABEL) as RecurringFrequency[]).map((k) => (
                  <option key={k} value={k}>
                    {FREQ_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Next / first invoice date
              <input
                type="date"
                value={f.nextDate}
                onChange={(e) => set("nextDate", e.target.value)}
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              Ends on (optional)
              <input
                type="date"
                value={f.endDate ?? ""}
                onChange={(e) => set("endDate", e.target.value || null)}
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              Payment terms
              <select
                value={f.paymentTermsDays}
                onChange={(e) => set("paymentTermsDays", parseInt(e.target.value) || 0)}
                className={input + " mt-1 font-normal"}
              >
                {TERMS_PRESETS.map((t) => (
                  <option key={t.days} value={t.days}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 text-[12px] font-bold text-[#42506b]">Line items</div>
          {f.items.map((it, i) => (
            <div key={i} className="mt-2 grid grid-cols-[1fr_70px_110px_32px] items-center gap-2">
              <input
                value={it.description}
                onChange={(e) => setItem(i, { description: e.target.value })}
                placeholder="Description"
                className={input}
              />
              <NumberInput
                value={it.qty}
                onChange={(n) => setItem(i, { qty: n })}
                className={input + " text-right"}
                title="Qty"
              />
              <NumberInput
                value={it.rate}
                onChange={(n) => setItem(i, { rate: n })}
                className={input + " text-right"}
                title="Rate ₹"
              />
              <button
                onClick={() => setF((p) => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                disabled={f.items.length === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2cad8] hover:text-[#dc2626] disabled:opacity-30"
              >
                <Trash2 size={14} />
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
            className="mt-2 flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
          >
            <Plus size={13} /> Add item
          </button>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <label className={lbl}>
              Tax
              <select
                value={f.taxMode}
                onChange={(e) => set("taxMode", e.target.value as InvoiceTaxMode)}
                className={input + " mt-1 font-normal"}
              >
                {(Object.keys(TAX_MODE_LABEL) as InvoiceTaxMode[]).map((k) => (
                  <option key={k} value={k}>
                    {TAX_MODE_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              GST %
              <NumberInput
                value={f.gstPercent}
                disabled={f.taxMode === "none"}
                onChange={(n) => set("gstPercent", n)}
                className={input + " mt-1 font-normal disabled:opacity-50"}
              />
            </label>
            <label className={lbl}>
              Discount %
              <NumberInput
                value={f.discountPercent}
                onChange={(n) => set("discountPercent", n)}
                className={input + " mt-1 font-normal"}
              />
            </label>
          </div>

          <div className="mt-3 rounded-[10px] bg-[#f8fafc] px-4 py-3 text-[13px] font-bold text-[#42506b]">
            Each invoice will total{" "}
            <span className="tf-num text-[15px] font-extrabold text-[#2a6fdb]">{money(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#eef1f6] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            <Save size={14} /> {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
