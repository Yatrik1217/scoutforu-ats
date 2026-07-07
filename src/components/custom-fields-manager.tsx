"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addCustomField,
  setCustomFieldActive,
  deleteCustomField,
} from "@/lib/actions/mutations";
import type { CustomFieldRow, CustomFieldModule, CustomFieldType } from "@/lib/database.types";

const MODULES: { key: CustomFieldModule; label: string }[] = [
  { key: "candidate", label: "Candidates" },
  { key: "job", label: "Jobs" },
  { key: "client", label: "Clients" },
];

const field =
  "rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";

export function CustomFieldsManager({ fields }: { fields: CustomFieldRow[] }) {
  const [module, setModule] = useState<CustomFieldModule>("candidate");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [options, setOptions] = useState("");
  const [pending, start] = useTransition();

  const shown = fields.filter((f) => f.module === module);

  const add = () => {
    if (!label.trim()) return;
    start(async () => {
      const res = await addCustomField({
        module,
        label,
        type,
        options: type === "select" ? options.split(",") : [],
      });
      if (res.ok) {
        toast.success(res.message || "Added");
        setLabel("");
        setOptions("");
      } else toast.error(res.error || "Failed");
    });
  };
  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await setCustomFieldActive(id, active);
      if (!res.ok) toast.error(res.error || "Failed");
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteCustomField(id);
      if (res.ok) toast.success(res.message || "Removed");
      else toast.error(res.error || "Failed");
    });

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-[10px] bg-[#f1f4f9] p-1">
        {MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => setModule(m.key)}
            className={`flex-1 rounded-[8px] py-1.5 text-[12.5px] font-bold transition ${
              module === m.key ? "bg-white text-[#16203a] shadow-sm" : "text-[#8a94a6]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Field label" className={field + " flex-1"} />
        <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className={field}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="select">Dropdown</option>
        </select>
        {type === "select" && (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Options, comma-separated"
            className={field + " flex-1 basis-full"}
          />
        )}
        <button
          onClick={add}
          disabled={pending || !label.trim()}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
        {shown.map((f) => (
          <div key={f.id} className="flex items-center gap-3 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0">
            <div className="flex-1">
              <span className={`text-[13px] font-bold ${f.active ? "text-[#16203a]" : "text-[#b6bfce] line-through"}`}>
                {f.label}
              </span>
              <span className="ml-2 rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[10px] font-bold text-[#6b7686]">
                {f.type}
                {f.type === "select" && f.options.length ? `: ${f.options.join(", ")}` : ""}
              </span>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#8a94a6]">
              <input type="checkbox" checked={f.active} onChange={(e) => toggle(f.id, e.target.checked)} className="h-3.5 w-3.5 accent-[#2a6fdb]" />
              Active
            </label>
            <button onClick={() => remove(f.id)} className="text-[#c2cad6] hover:text-[#dc2626]">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!shown.length && (
          <div className="px-4 py-6 text-center text-[12px] text-[#9aa4b6]">
            No custom fields for {MODULES.find((m) => m.key === module)?.label.toLowerCase()} yet.
          </div>
        )}
      </div>
    </div>
  );
}
