"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  updateOrganization,
  addBranch,
  setBranchActive,
  deleteBranch,
} from "@/lib/actions/mutations";
import type { OrganizationRow, BranchRow } from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

export function OrganizationForm({ org }: { org: OrganizationRow | null }) {
  const [f, setF] = useState({
    name: org?.name ?? "",
    tagline: org?.tagline ?? "",
    logo_url: org?.logo_url ?? "",
    address: org?.address ?? "",
    city: org?.city ?? "",
    gst: org?.gst ?? "",
    phone: org?.phone ?? "",
    email: org?.email ?? "",
    website: org?.website ?? "",
  });
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    start(async () => {
      const res = await updateOrganization(f);
      if (res.ok) toast.success(res.message || "Saved");
      else toast.error(res.error || "Failed");
    });

  const fields: [string, keyof typeof f, string][] = [
    ["Company name", "name", "ScoutforU Consultants"],
    ["Tagline", "tagline", "Recruitment, done right"],
    ["Logo URL", "logo_url", "https://…/logo.png"],
    ["City", "city", "Ahmedabad"],
    ["Phone", "phone", "+91 …"],
    ["Email", "email", "hello@scoutforu.com"],
    ["Website", "website", "https://scoutforu.com"],
    ["GST / Tax No.", "gst", "24ABCDE…"],
  ];

  return (
    <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
      <div className="mb-4 text-[15px] font-extrabold text-[#16203a]">Organization Info</div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([label, k, ph]) => (
          <label key={k} className="text-[12px] font-bold text-[#42506b]">
            {label}
            <input
              value={f[k]}
              onChange={(e) => set(k, e.target.value)}
              placeholder={ph}
              className={field + " mt-1 font-normal"}
            />
          </label>
        ))}
      </div>
      <label className="mt-3 block text-[12px] font-bold text-[#42506b]">
        Address
        <textarea
          value={f.address}
          onChange={(e) => set("address", e.target.value)}
          rows={2}
          className={field + " mt-1 resize-none font-normal"}
        />
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

export function BranchesManager({ branches }: { branches: BranchRow[] }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [pending, start] = useTransition();

  const add = () => {
    if (!name.trim()) return;
    start(async () => {
      const res = await addBranch(name, city);
      if (res.ok) {
        toast.success(res.message || "Added");
        setName("");
        setCity("");
      } else toast.error(res.error || "Failed");
    });
  };
  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await setBranchActive(id, active);
      if (!res.ok) toast.error(res.error || "Failed");
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteBranch(id);
      if (res.ok) toast.success(res.message || "Removed");
      else toast.error(res.error || "Failed");
    });

  return (
    <div className="rounded-[12px] border border-[#e9edf3] bg-white p-5">
      <div className="mb-4 text-[15px] font-extrabold text-[#16203a]">Branches</div>
      <div className="mb-4 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch name" className={field} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className={field + " max-w-[160px]"} />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
        >
          <Plus size={15} /> Add
        </button>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
        {branches.map((b) => (
          <div key={b.id} className="flex items-center gap-3 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0">
            <div className="flex-1">
              <span className={`text-[13px] font-bold ${b.active ? "text-[#16203a]" : "text-[#b6bfce] line-through"}`}>
                {b.name}
              </span>
              {b.city && <span className="ml-2 text-[11px] text-[#9aa4b6]">{b.city}</span>}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#8a94a6]">
              <input type="checkbox" checked={b.active} onChange={(e) => toggle(b.id, e.target.checked)} className="h-3.5 w-3.5 accent-[#2a6fdb]" />
              Active
            </label>
            <button onClick={() => remove(b.id)} className="text-[#c2cad6] hover:text-[#dc2626]">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!branches.length && (
          <div className="px-4 py-6 text-center text-[12px] text-[#9aa4b6]">No branches yet.</div>
        )}
      </div>
    </div>
  );
}
