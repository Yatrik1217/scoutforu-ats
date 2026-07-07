"use client";

import { useState, useTransition } from "react";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";
import {
  setUserApprover,
  updateEmailTemplate,
  updateInvoiceSettings,
} from "@/lib/actions/mutations";
import { sendTestSms } from "@/lib/actions/sms";
import { Avatar } from "@/components/bits";
import type { EmailTemplateRow, InvoiceSettingsRow } from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

// ---- Approvers -----------------------------------------------------------------

export function ApproversManager({
  staff,
}: {
  staff: { id: string; name: string; email: string; role: string; is_approver: boolean }[];
}) {
  const [pending, start] = useTransition();
  const toggle = (id: string, v: boolean) =>
    start(async () => {
      const res = await setUserApprover(id, v);
      if (!res.ok) toast.error(res.error || "Failed");
    });

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
      {staff.map((u) => (
        <div key={u.id} className="flex items-center gap-3 border-b border-[#f4f6fa] px-4 py-3 last:border-0">
          <Avatar name={u.name} size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-bold text-[#16203a]">{u.name}</div>
            <div className="text-[11px] text-[#9aa4b6]">{u.email}</div>
          </div>
          {u.role === "master_admin" ? (
            <span className="text-[11px] font-bold text-[#8a94a6]">Always an approver</span>
          ) : (
            <label className="flex items-center gap-1.5 text-[11.5px] font-bold text-[#42506b]">
              <input
                type="checkbox"
                checked={u.is_approver}
                disabled={pending}
                onChange={(e) => toggle(u.id, e.target.checked)}
                className="h-4 w-4 accent-[#2a6fdb]"
              />
              Approver
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Email templates -------------------------------------------------------------

export function EmailTemplatesEditor({ templates }: { templates: EmailTemplateRow[] }) {
  const [sel, setSel] = useState(templates[0]?.id ?? "");
  const current = templates.find((t) => t.id === sel);
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [pending, start] = useTransition();

  const pick = (id: string) => {
    const t = templates.find((x) => x.id === id);
    setSel(id);
    setSubject(t?.subject ?? "");
    setBody(t?.body ?? "");
  };
  const save = () => {
    if (!current) return;
    start(async () => {
      const res = await updateEmailTemplate(current.id, subject, body);
      if (res.ok) toast.success(res.message || "Saved");
      else toast.error(res.error || "Failed");
    });
  };

  if (!templates.length)
    return <div className="rounded-[10px] border border-[#eef1f6] p-6 text-center text-[12.5px] text-[#9aa4b6]">No templates found — run the settings SQL first.</div>;

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => pick(t.id)}
            className={`flex-1 rounded-[8px] px-2 py-1.5 text-[12px] font-bold transition ${
              sel === t.id ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <label className="block text-[12px] font-bold text-[#42506b]">
        Subject
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={field + " mt-1 font-normal"} />
      </label>
      <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
        Body
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={field + " mt-1 resize-y font-normal"} />
      </label>
      <div className="mt-2 text-[11.5px] text-[#8a94a6]">
        Placeholders: <code>{"{{client_name}}"}</code> <code>{"{{candidate_name}}"}</code>{" "}
        <code>{"{{job_title}}"}</code> <code>{"{{count}}"}</code> <code>{"{{sender_name}}"}</code>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Save size={15} /> {pending ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}

// ---- SMS test -------------------------------------------------------------------

export function SmsTestForm({ configured }: { configured: boolean }) {
  const [phone, setPhone] = useState("");
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const res = await sendTestSms(phone);
      if (res.ok) toast.success(res.message || "Sent");
      else toast.error(res.error || "Failed");
    });
  return (
    <div className="mt-4 flex gap-2">
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Your mobile number"
        disabled={!configured}
        className={field + " disabled:opacity-50"}
      />
      <button
        onClick={send}
        disabled={!configured || pending || !phone.trim()}
        className="flex shrink-0 items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
      >
        <Send size={14} /> {pending ? "Sending…" : "Send test SMS"}
      </button>
    </div>
  );
}

// ---- Invoice settings -------------------------------------------------------------

export function InvoiceSettingsForm({ settings }: { settings: InvoiceSettingsRow | null }) {
  const [f, setF] = useState({
    prefix: settings?.prefix ?? "INV-",
    next_number: String(settings?.next_number ?? 1),
    gst_percent: String(settings?.gst_percent ?? 18),
    pan: settings?.pan ?? "",
    gstin: settings?.gstin ?? "",
    bank_details: settings?.bank_details ?? "",
    terms: settings?.terms ?? "",
  });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await updateInvoiceSettings({
        prefix: f.prefix,
        next_number: parseInt(f.next_number) || 1,
        gst_percent: parseFloat(f.gst_percent) || 0,
        pan: f.pan,
        gstin: f.gstin,
        bank_details: f.bank_details,
        terms: f.terms,
      });
      if (res.ok) toast.success(res.message || "Saved");
      else toast.error(res.error || "Failed");
    });

  return (
    <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
      <div className="grid grid-cols-3 gap-3">
        <label className="text-[12px] font-bold text-[#42506b]">
          Invoice prefix
          <input value={f.prefix} onChange={(e) => set("prefix", e.target.value)} className={field + " mt-1 font-normal"} placeholder="INV-" />
        </label>
        <label className="text-[12px] font-bold text-[#42506b]">
          Next number
          <input inputMode="numeric" value={f.next_number} onChange={(e) => set("next_number", e.target.value.replace(/\D/g, ""))} className={field + " mt-1 font-normal"} />
        </label>
        <label className="text-[12px] font-bold text-[#42506b]">
          GST %
          <input inputMode="decimal" value={f.gst_percent} onChange={(e) => set("gst_percent", e.target.value.replace(/[^0-9.]/g, ""))} className={field + " mt-1 font-normal"} />
        </label>
        <label className="text-[12px] font-bold text-[#42506b]">
          PAN
          <input value={f.pan} onChange={(e) => set("pan", e.target.value)} className={field + " mt-1 font-normal"} />
        </label>
        <label className="col-span-2 text-[12px] font-bold text-[#42506b]">
          GSTIN
          <input value={f.gstin} onChange={(e) => set("gstin", e.target.value)} className={field + " mt-1 font-normal"} />
        </label>
      </div>
      <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
        Bank details (shown on invoices)
        <textarea value={f.bank_details} onChange={(e) => set("bank_details", e.target.value)} rows={3} className={field + " mt-1 resize-none font-normal"} placeholder={"Account name\nAccount number · IFSC\nBank & branch"} />
      </label>
      <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
        Terms & notes
        <textarea value={f.terms} onChange={(e) => set("terms", e.target.value)} rows={3} className={field + " mt-1 resize-none font-normal"} placeholder="Payment due within 30 days…" />
      </label>
      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={pending}
          className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
        >
          <Save size={15} /> {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
