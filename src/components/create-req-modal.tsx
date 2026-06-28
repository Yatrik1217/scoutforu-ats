"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createRequisition } from "@/lib/actions/mutations";
import type { ClientRow, EmploymentType, ProfileRow } from "@/lib/database.types";

const DEPTS = ["Engineering", "Design", "Product", "Data", "Infrastructure"];
const LOCS = ["Bangalore", "Mumbai", "Pune", "Hyderabad", "Remote"];
const TYPES: { label: string; value: EmploymentType }[] = [
  { label: "Full-time", value: "full_time" },
  { label: "Contract", value: "contract" },
  { label: "Intern", value: "intern" },
];

const fieldCls =
  "w-full rounded-[10px] border border-[#e3e8f0] px-3 py-2.5 text-[13.5px] font-semibold text-[#16203a] outline-none focus:border-[#2a6fdb]";
const labelCls = "mb-1.5 block text-xs font-bold text-[#42506b]";

export function CreateReqModal({
  open,
  team,
  clients,
  onClose,
}: {
  open: boolean;
  team: ProfileRow[];
  clients: ClientRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState(false);
  const [f, setF] = useState<{
    title: string;
    dept: string;
    location: string;
    type: EmploymentType;
    openings: number;
    clientId: string | null;
    recruiterId: string | null;
    description: string;
  }>({
    title: "",
    dept: "Engineering",
    location: "Bangalore",
    type: "full_time",
    openings: 1,
    clientId: clients[0]?.id ?? null,
    recruiterId: team[0]?.id ?? null,
    description: "",
  });

  if (!open) return null;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((s) => ({ ...s, [k]: v }));

  const submit = () => {
    if (!f.title.trim()) {
      setErr(true);
      return;
    }
    start(async () => {
      const res = await createRequisition(f);
      if (res.ok) {
        toast.success(res.message ?? "Requisition created");
        onClose();
        setF((s) => ({ ...s, title: "", description: "" }));
        setErr(false);
        router.push("/jobs");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(16,24,40,.5)] p-4 animate-sc-fadein"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-[560px] overflow-y-auto rounded-[18px] bg-white shadow-[0_24px_60px_rgba(16,24,40,.3)] animate-sc-popin"
      >
        <div className="flex items-center justify-between border-b border-[#f0f3f8] p-[22px_24px_16px]">
          <div>
            <div className="text-[18px] font-extrabold">Create Requisition</div>
            <div className="text-[12.5px] font-medium text-[#8a94a6]">
              Open a new role and start sourcing
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#e6eaf1] text-[#9aa4b6] hover:bg-[#f6f8fb]"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <div className="p-[22px_24px]">
          <label className={labelCls}>
            Job Title <span className="text-[#ef4444]">*</span>
          </label>
          <input
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            className={fieldCls}
            style={err ? { borderColor: "#ef4444" } : undefined}
          />
          {err && (
            <div className="mt-1.5 text-[11.5px] font-semibold text-[#ef4444]">
              Please enter a job title.
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3.5">
            <div>
              <label className={labelCls}>Department</label>
              <select
                value={f.dept}
                onChange={(e) => set("dept", e.target.value)}
                className={`${fieldCls} cursor-pointer`}
              >
                {DEPTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <select
                value={f.location}
                onChange={(e) => set("location", e.target.value)}
                className={`${fieldCls} cursor-pointer`}
              >
                {LOCS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Employment Type</label>
              <select
                value={f.type}
                onChange={(e) => set("type", e.target.value as EmploymentType)}
                className={`${fieldCls} cursor-pointer`}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Openings</label>
              <input
                type="number"
                min={1}
                value={f.openings}
                onChange={(e) => set("openings", Number(e.target.value))}
                className={fieldCls}
              />
            </div>
            <div>
              <label className={labelCls}>Client</label>
              <select
                value={f.clientId ?? ""}
                onChange={(e) => set("clientId", e.target.value || null)}
                className={`${fieldCls} cursor-pointer`}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assign Recruiter</label>
              <select
                value={f.recruiterId ?? ""}
                onChange={(e) => set("recruiterId", e.target.value || null)}
                className={`${fieldCls} cursor-pointer`}
              >
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className={`${labelCls} mt-4`}>Description</label>
          <textarea
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            placeholder="Role summary, must-have skills, responsibilities…"
            className={`${fieldCls} resize-y font-medium`}
          />
        </div>

        <div className="flex gap-2.5 border-t border-[#f0f3f8] p-[16px_24px]">
          <button
            onClick={onClose}
            className="flex-1 rounded-[11px] border border-[#e6eaf1] py-3 text-[13.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={pending}
            className="flex-[2] rounded-[11px] bg-[#2a6fdb] py-3 text-[13.5px] font-bold text-white shadow-[0_4px_12px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0] disabled:opacity-60"
          >
            Create &amp; Publish Role
          </button>
        </div>
      </div>
    </div>
  );
}
