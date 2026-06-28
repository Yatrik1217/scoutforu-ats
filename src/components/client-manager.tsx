"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, X } from "lucide-react";
import { saveClient, deleteClientRecord } from "@/lib/actions/mutations";

type ClientItem = {
  id: string;
  name: string;
  status: string;
  contact_email: string | null;
  jobs: number;
  cands: number;
};

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";

export function ClientManager({
  clients,
  isAdmin,
}: {
  clients: ClientItem[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [editing, setEditing] = useState<ClientItem | "new" | null>(null);
  const [form, setForm] = useState({ name: "", status: "Active", email: "" });

  const openNew = () => {
    setForm({ name: "", status: "Active", email: "" });
    setEditing("new");
  };
  const openEdit = (c: ClientItem) => {
    setForm({ name: c.name, status: c.status, email: c.contact_email ?? "" });
    setEditing(c);
  };

  const save = () =>
    start(async () => {
      const id = editing && editing !== "new" ? editing.id : null;
      const res = await saveClient(id, form.name, form.status, form.email);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setEditing(null);
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
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
          >
            <Plus size={14} strokeWidth={2.4} /> Add Client
          </button>
        )}
      </div>

      {clients.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-3 border-b border-[#f0f3f8] py-2.5 last:border-0"
        >
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#eef4fe] text-[#2a6fdb]">
            <Building2 size={17} />
          </div>
          <div className="flex-1">
            <div className="text-[13.5px] font-bold">{c.name}</div>
            <div className="text-[11.5px] text-[#9aa4b6]">
              {c.jobs} roles · {c.cands} candidates
            </div>
          </div>
          <span className="rounded-full bg-[#e9f9ef] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
            {c.status}
          </span>
          {isAdmin && (
            <div className="flex gap-1">
              <button onClick={() => openEdit(c)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(c)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#fef2f2] hover:text-[#dc2626]">
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      ))}

      {editing && (
        <div
          onClick={() => setEditing(null)}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[440px] rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
          >
            <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[20px_22px_14px]">
              <div className="text-[17px] font-extrabold">
                {editing === "new" ? "Add Client" : "Edit Client"}
              </div>
              <button onClick={() => setEditing(null)} className="flex h-[32px] w-[32px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]">
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
            <div className="space-y-3.5 p-[20px_22px]">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#42506b]">Client name</label>
                <input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className={fieldCls} placeholder="e.g. Acme Corp" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#42506b]">Contact email</label>
                <input value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} className={fieldCls} placeholder="hr@client.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#42506b]">Status</label>
                <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))} className={`${fieldCls} cursor-pointer`}>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2.5 border-t border-[#f0f3f8] p-[14px_22px]">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-[11px] border border-[#e6eaf1] py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">
                Cancel
              </button>
              <button onClick={save} className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-2.5 text-[13px] font-bold text-white hover:bg-[#1f5bc0]">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
