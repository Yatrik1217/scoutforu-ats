"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, Save, Pencil, UserMinus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { saveEmployee, setEmployeeStatus, type EmployeeForm } from "@/lib/actions/hr";
import { NumberInput } from "@/components/number-input";
import { Avatar } from "@/components/bits";
import { money } from "@/lib/invoice";
import type { EmployeeRow, EmployeeEmploymentType } from "@/lib/database.types";

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

const TYPE_LABEL: Record<EmployeeEmploymentType, string> = {
  full_time: "Full-time",
  contract: "Contract",
  intern: "Intern",
  part_time: "Part-time",
};

export function EmployeeManager({
  employees,
  logins,
}: {
  employees: EmployeeRow[];
  logins: { id: string; name: string; email: string }[];
}) {
  const [editing, setEditing] = useState<EmployeeRow | "new" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const toggle = (e: EmployeeRow) =>
    start(async () => {
      const res = await setEmployeeStatus(e.id, e.status === "active" ? "exited" : "active");
      if (res.ok) {
        toast.success(res.message || "Updated");
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const active = employees.filter((e) => e.status === "active");
  const monthlyCost = active.reduce((s, e) => s + e.monthly_gross, 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] text-[#8a94a6]">
          {active.length} active · monthly salary cost{" "}
          <b className="text-[#16203a]">{money(monthlyCost)}</b>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0]"
        >
          <Plus size={15} /> Add employee
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.5fr_1.1fr_110px_130px_110px_110px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Employee</div>
          <div>Designation</div>
          <div>Type</div>
          <div className="text-right">Monthly gross</div>
          <div className="text-center">Login</div>
          <div className="text-right">Actions</div>
        </div>
        {employees.map((e) => (
          <div
            key={e.id}
            className={`grid grid-cols-[1.5fr_1.1fr_110px_130px_110px_110px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 last:border-0 ${
              e.status === "exited" ? "opacity-55" : ""
            }`}
          >
            <Link href={`/employees/${e.id}`} className="flex min-w-0 items-center gap-3">
              <Avatar name={e.name} size={34} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-[#16203a]">{e.name}</div>
                <div className="truncate text-[11px] text-[#a3acbd]">
                  {e.employee_code ? `${e.employee_code} · ` : ""}
                  {e.email || "—"}
                </div>
              </div>
            </Link>
            <div className="truncate text-[12.5px] font-semibold text-[#42506b]">
              {e.designation || "—"}
            </div>
            <div className="text-[12px] font-semibold text-[#7a8696]">
              {TYPE_LABEL[e.employment_type]}
            </div>
            <div className="tf-num text-right text-[13px] font-extrabold">
              {e.monthly_gross ? money(e.monthly_gross) : "—"}
            </div>
            <div className="text-center">
              {e.profile_id ? (
                <span className="rounded-full bg-[#e9f9ef] px-2 py-0.5 text-[10.5px] font-bold text-[#16a34a]">
                  Linked
                </span>
              ) : (
                <span className="rounded-full bg-[#f1f4f9] px-2 py-0.5 text-[10.5px] font-bold text-[#8a94a6]">
                  No login
                </span>
              )}
            </div>
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => setEditing(e)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8a94a6] hover:bg-[#f1f4f9]"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => toggle(e)}
                disabled={pending}
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  e.status === "active"
                    ? "text-[#c2cad8] hover:bg-[#fef2f2] hover:text-[#dc2626]"
                    : "text-[#16a34a] hover:bg-[#e9f9ef]"
                }`}
                title={e.status === "active" ? "Mark as exited" : "Reactivate"}
              >
                {e.status === "active" ? <UserMinus size={14} /> : <UserCheck size={14} />}
              </button>
            </div>
          </div>
        ))}
        {employees.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No employees yet — add your first.
          </div>
        )}
      </div>

      {editing && (
        <EmployeeModal
          employee={editing === "new" ? null : editing}
          logins={logins}
          taken={employees.map((e) => e.profile_id).filter(Boolean) as string[]}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EmployeeModal({
  employee,
  logins,
  taken,
  onClose,
}: {
  employee: EmployeeRow | null;
  logins: { id: string; name: string; email: string }[];
  taken: string[];
  onClose: () => void;
}) {
  const [f, setF] = useState<EmployeeForm>({
    profileId: employee?.profile_id ?? null,
    employeeCode: employee?.employee_code ?? "",
    name: employee?.name ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    designation: employee?.designation ?? "",
    department: employee?.department ?? "",
    employmentType: employee?.employment_type ?? "full_time",
    joinedOn: employee?.joined_on ?? null,
    monthlyGross: employee?.monthly_gross ?? 0,
    pan: employee?.pan ?? "",
    bankAccount: employee?.bank_account ?? "",
    bankIfsc: employee?.bank_ifsc ?? "",
    uan: employee?.uan ?? "",
    notes: employee?.notes ?? "",
  });
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const available = logins.filter(
    (l) => !taken.includes(l.id) || l.id === employee?.profile_id,
  );

  const save = () =>
    start(async () => {
      const res = await saveEmployee(employee?.id ?? null, f);
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
            {employee ? `Edit ${employee.name}` : "Add employee"}
          </h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className={lbl}>
              Full name*
              <input value={f.name} onChange={(e) => set("name", e.target.value)} className={input + " mt-1 font-normal"} />
            </label>
            <label className={lbl}>
              Employee code
              <input value={f.employeeCode} onChange={(e) => set("employeeCode", e.target.value)} className={input + " mt-1 font-normal"} placeholder="SFU-001" />
            </label>
            <label className={lbl}>
              Email
              <input value={f.email} onChange={(e) => set("email", e.target.value)} className={input + " mt-1 font-normal"} />
            </label>
            <label className={lbl}>
              Phone
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={input + " mt-1 font-normal"} />
            </label>
            <label className={lbl}>
              Designation
              <input value={f.designation} onChange={(e) => set("designation", e.target.value)} className={input + " mt-1 font-normal"} placeholder="Recruiter" />
            </label>
            <label className={lbl}>
              Department
              <input value={f.department} onChange={(e) => set("department", e.target.value)} className={input + " mt-1 font-normal"} />
            </label>
            <label className={lbl}>
              Employment type
              <select
                value={f.employmentType}
                onChange={(e) => set("employmentType", e.target.value as EmployeeEmploymentType)}
                className={input + " mt-1 font-normal"}
              >
                {(Object.keys(TYPE_LABEL) as EmployeeEmploymentType[]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Date of joining
              <input
                type="date"
                value={f.joinedOn ?? ""}
                onChange={(e) => set("joinedOn", e.target.value || null)}
                className={input + " mt-1 font-normal"}
              />
            </label>
          </div>

          <div className="mt-4 rounded-[10px] border border-[#eef1f6] p-4">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#16203a]">Salary</div>
            <label className={lbl}>
              Monthly gross (₹)
              <NumberInput
                value={f.monthlyGross}
                onChange={(n) => set("monthlyGross", n)}
                className={input + " mt-1 font-normal"}
                placeholder="40000"
              />
              <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
                Payroll prorates this for unpaid-leave days. Basic/HRA breakdown can be added later.
              </span>
            </label>
          </div>

          <div className="mt-4 rounded-[10px] border border-[#eef1f6] p-4">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#16203a]">
              Login & statutory
            </div>
            <label className={lbl}>
              Linked ATS login
              <select
                value={f.profileId ?? ""}
                onChange={(e) => set("profileId", e.target.value || null)}
                className={input + " mt-1 font-normal"}
              >
                <option value="">— No login (not an ATS user) —</option>
                {available.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} · {l.email}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-medium text-[#a3acbd]">
                Linking a login lets them apply for leave and see their payslips. Incentives are
                matched through this link too.
              </span>
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className={lbl}>
                PAN
                <input value={f.pan} onChange={(e) => set("pan", e.target.value)} className={input + " mt-1 font-normal"} />
              </label>
              <label className={lbl}>
                UAN (PF)
                <input value={f.uan} onChange={(e) => set("uan", e.target.value)} className={input + " mt-1 font-normal"} />
              </label>
              <label className={lbl}>
                Bank account
                <input value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} className={input + " mt-1 font-normal"} />
              </label>
              <label className={lbl}>
                IFSC
                <input value={f.bankIfsc} onChange={(e) => set("bankIfsc", e.target.value)} className={input + " mt-1 font-normal"} />
              </label>
            </div>
          </div>

          <label className={lbl + " mt-4"}>
            Notes
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={input + " mt-1 resize-none font-normal"} />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#eef1f6] px-5 py-4">
          <button onClick={onClose} className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
          >
            <Save size={14} /> {pending ? "Saving…" : "Save employee"}
          </button>
        </div>
      </div>
    </div>
  );
}
