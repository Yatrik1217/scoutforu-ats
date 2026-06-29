"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import {
  saveClient,
  deleteClientRecord,
  type ClientForm,
} from "@/lib/actions/mutations";
import { INDIAN_CITIES, INDUSTRIES, CLIENT_RATINGS } from "@/lib/domain";
import type { ClientRow, ProfileRow } from "@/lib/database.types";

type ClientItem = ClientRow & { jobs: number; cands: number };

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

const blank: ClientForm = {
  name: "",
  status: "Active",
  city: "",
  referenceCode: "",
  rating: "",
  industry: "",
  contactNumber: "",
  contactEmail: "",
  keyAccountManagerId: null,
  transportation: false,
  canteen: false,
  website: "",
  linkedinUrl: "",
  address: "",
  profile: "",
  remarks: "",
};

export function ClientManager({
  clients,
  team,
  isAdmin,
}: {
  clients: ClientItem[];
  team: ProfileRow[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<ClientForm>(blank);

  const set = <K extends keyof ClientForm>(k: K, v: ClientForm[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const openNew = () => {
    setF(blank);
    setEditId(null);
    setOpen(true);
  };
  const openEdit = (c: ClientItem) => {
    setF({
      name: c.name,
      status: c.status,
      city: c.city,
      referenceCode: c.reference_code,
      rating: c.rating,
      industry: c.industry,
      contactNumber: c.contact_number,
      contactEmail: c.contact_email ?? "",
      keyAccountManagerId: c.key_account_manager_id,
      transportation: c.transportation,
      canteen: c.canteen,
      website: c.website,
      linkedinUrl: c.linkedin_url,
      address: c.address,
      profile: c.profile,
      remarks: c.remarks,
    });
    setEditId(c.id);
    setOpen(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveClient(editId, f);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  const remove = (c: ClientItem) => {
    if (!confirm(`Delete client "${c.name}"? Its roles become unassigned.`)) return;
    start(async () => {
      const res = await deleteClientRecord(c.id);
      if (res.ok) {
        toast.success(res.message ?? "Deleted");
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });
  };

  return (
    <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15.5px] font-extrabold">Clients</div>
        {isAdmin && (
          <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]">
            <Plus size={14} strokeWidth={2.4} /> Add Client
          </button>
        )}
      </div>

      {clients.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-b border-[#f0f3f8] py-2.5 last:border-0">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#eef4fe] text-[#2a6fdb]">
            <Building2 size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[13.5px] font-bold">
              {c.name}
              {c.rating && <span className="rounded bg-[#fff7e6] px-1.5 py-px text-[10px] font-bold text-[#b27400]">{c.rating}</span>}
            </div>
            <div className="truncate text-[11.5px] text-[#9aa4b6]">
              {[c.city, c.industry].filter(Boolean).join(" · ") || `${c.jobs} roles · ${c.cands} candidates`}
            </div>
          </div>
          <span className="rounded-full bg-[#e9f9ef] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">{c.status}</span>
          {isAdmin && (
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"><Pencil size={14} /></button>
              <button onClick={() => remove(c)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#fef2f2] hover:text-[#dc2626]"><Trash2 size={14} /></button>
            </div>
          )}
        </div>
      ))}

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein">
          <datalist id="india-cities-client">
            {INDIAN_CITIES.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-[680px] max-w-full overflow-y-auto rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f0f3f8] bg-white p-[20px_24px_14px]">
              <div className="text-[18px] font-extrabold">{editId ? "Edit Client Account" : "New Client Account"}</div>
              <button onClick={() => setOpen(false)} className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"><X size={16} strokeWidth={2.4} /></button>
            </div>

            <div className="space-y-3.5 p-[20px_24px]">
              <div className="grid grid-cols-3 gap-3.5">
                <Field label="Client Name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={fieldCls} placeholder="Client name" /></Field>
                <Field label="City"><input list="india-cities-client" value={f.city} onChange={(e) => set("city", e.target.value)} className={fieldCls} placeholder="City" /></Field>
                <Field label="Reference Code"><input value={f.referenceCode} onChange={(e) => set("referenceCode", e.target.value)} className={fieldCls} placeholder="REF" /></Field>
                <Field label="Rating">
                  <select value={f.rating} onChange={(e) => set("rating", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                    <option value="">— Select —</option>
                    {CLIENT_RATINGS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Industry">
                  <select value={f.industry} onChange={(e) => set("industry", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                    <option value="">— Select —</option>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={f.status} onChange={(e) => set("status", e.target.value)} className={`${fieldCls} cursor-pointer`}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </Field>
                <Field label="Contact Number"><input value={f.contactNumber} onChange={(e) => set("contactNumber", e.target.value)} className={fieldCls} placeholder="Landline or mobile" /></Field>
                <Field label="Email ID for Billing"><input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={fieldCls} placeholder="hr@client.com" /></Field>
                <Field label="Key Account Manager">
                  <select value={f.keyAccountManagerId ?? ""} onChange={(e) => set("keyAccountManagerId", e.target.value || null)} className={`${fieldCls} cursor-pointer`}>
                    <option value="">— None —</option>
                    {team.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
              </div>

              <div className="flex gap-8 pt-1">
                <label className="flex items-center gap-2 text-[13px] font-bold text-[#42506b]"><input type="checkbox" checked={f.transportation} onChange={(e) => set("transportation", e.target.checked)} className="h-4 w-4" />Transportation Available</label>
                <label className="flex items-center gap-2 text-[13px] font-bold text-[#42506b]"><input type="checkbox" checked={f.canteen} onChange={(e) => set("canteen", e.target.checked)} className="h-4 w-4" />Canteen Available</label>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <Field label="Website"><input value={f.website} onChange={(e) => set("website", e.target.value)} className={fieldCls} placeholder="https://…" /></Field>
                <Field label="LinkedIn Page URL"><input value={f.linkedinUrl} onChange={(e) => set("linkedinUrl", e.target.value)} className={fieldCls} placeholder="https://linkedin.com/company/…" /></Field>
              </div>
              <Field label="Address"><textarea value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className={`${fieldCls} resize-y font-medium`} placeholder="Client mailing address" /></Field>
              <Field label="Client Profile"><textarea value={f.profile} onChange={(e) => set("profile", e.target.value)} rows={2} className={`${fieldCls} resize-y font-medium`} placeholder="Shared with JD — avoid mentioning client name here" /></Field>
              <Field label="Research / Remarks"><textarea value={f.remarks} onChange={(e) => set("remarks", e.target.value)} rows={2} className={`${fieldCls} resize-y font-medium`} placeholder="Research on client and any remarks" /></Field>
            </div>

            <div className="sticky bottom-0 flex gap-2.5 border-t border-[#f0f3f8] bg-white p-[14px_24px]">
              <button onClick={() => setOpen(false)} className="flex-1 rounded-[11px] border border-[#e6eaf1] py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">Cancel</button>
              <button onClick={save} disabled={pending} className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-2.5 text-[13px] font-bold text-white hover:bg-[#1f5bc0] disabled:opacity-60">Save Client</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}
