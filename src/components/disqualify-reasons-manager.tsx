"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addDisqualifyReason,
  setDisqualifyReasonActive,
  deleteDisqualifyReason,
} from "@/lib/actions/mutations";
import type { DisqualifyReasonRow } from "@/lib/database.types";

export function DisqualifyReasonsManager({ reasons }: { reasons: DisqualifyReasonRow[] }) {
  const [label, setLabel] = useState("");
  const [pending, start] = useTransition();

  const add = () => {
    if (!label.trim()) return;
    start(async () => {
      const res = await addDisqualifyReason(label);
      if (res.ok) {
        toast.success(res.message || "Added");
        setLabel("");
      } else toast.error(res.error || "Failed");
    });
  };
  const toggle = (id: string, active: boolean) =>
    start(async () => {
      const res = await setDisqualifyReasonActive(id, active);
      if (!res.ok) toast.error(res.error || "Failed");
    });
  const remove = (id: string) =>
    start(async () => {
      const res = await deleteDisqualifyReason(id);
      if (res.ok) toast.success(res.message || "Removed");
      else toast.error(res.error || "Failed");
    });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add a rejection reason…"
          className="flex-1 rounded-[9px] border border-[#e3e8f0] px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
        />
        <button
          onClick={add}
          disabled={pending || !label.trim()}
          className="flex items-center gap-1.5 rounded-[9px] bg-[#2a6fdb] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-50"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-[#eef1f6]">
        {reasons.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-3 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0"
          >
            <span className={`flex-1 text-[13px] ${r.active ? "text-[#16203a]" : "text-[#b6bfce] line-through"}`}>
              {r.label}
            </span>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#8a94a6]">
              <input
                type="checkbox"
                checked={r.active}
                onChange={(e) => toggle(r.id, e.target.checked)}
                className="h-3.5 w-3.5 accent-[#2a6fdb]"
              />
              Active
            </label>
            <button onClick={() => remove(r.id)} className="text-[#c2cad6] hover:text-[#dc2626]">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {!reasons.length && (
          <div className="px-4 py-6 text-center text-[12px] text-[#9aa4b6]">
            No reasons yet — add your first above.
          </div>
        )}
      </div>
    </div>
  );
}
