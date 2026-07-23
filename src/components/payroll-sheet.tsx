"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Save, Plus, Trash2, Lock, Unlock, BadgeIndianRupee, Download } from "lucide-react";
import { toast } from "sonner";
import { updatePayrollLine, setPayrollStatus, createPayrollRun } from "@/lib/actions/hr";
import { NumberInput } from "@/components/number-input";
import { Avatar } from "@/components/bits";
import { money } from "@/lib/invoice";
import { computeNet, monthStart } from "@/lib/hr";
import type { PayLine, PayrollLineRow, PayrollRunRow, EmployeeRow } from "@/lib/database.types";

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function NewPayrollButton() {
  const [month, setMonth] = useState(() => monthStart(new Date()).slice(0, 7));
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
      />
      <button
        onClick={() =>
          start(async () => {
            const res = await createPayrollRun(`${month}-01`);
            if (res.ok && res.id) {
              toast.success(res.message || "Created");
              router.push(`/payroll/${res.id}`);
            } else toast.error(res.error || "Failed");
          })
        }
        disabled={pending}
        className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0] disabled:opacity-60"
      >
        <BadgeIndianRupee size={15} /> {pending ? "Working…" : "Run payroll"}
      </button>
    </div>
  );
}

export function PayrollActions({ run }: { run: PayrollRunRow }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (status: "draft" | "finalised" | "paid") =>
    start(async () => {
      const res = await setPayrollStatus(run.id, status);
      if (res.ok) {
        toast.success(res.message || "Done");
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const ghost =
    "flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {run.status === "draft" && (
        <button onClick={() => act("finalised")} disabled={pending} className={ghost}>
          <Lock size={14} /> Finalise
        </button>
      )}
      {run.status !== "draft" && run.status !== "paid" && (
        <button onClick={() => act("draft")} disabled={pending} className={ghost}>
          <Unlock size={14} /> Reopen
        </button>
      )}
      {run.status !== "paid" ? (
        <button
          onClick={() => act("paid")}
          disabled={pending}
          className="flex items-center gap-2 rounded-[10px] bg-[#16a34a] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#15803d] disabled:opacity-60"
        >
          <BadgeIndianRupee size={14} /> Mark as paid
        </button>
      ) : (
        <button onClick={() => act("finalised")} disabled={pending} className={ghost}>
          <Unlock size={14} /> Undo payment
        </button>
      )}
    </div>
  );
}

export function PayrollSheet({
  run,
  lines,
  employees,
}: {
  run: PayrollRunRow;
  lines: PayrollLineRow[];
  employees: EmployeeRow[];
}) {
  const [editing, setEditing] = useState<PayrollLineRow | null>(null);
  const empById = new Map(employees.map((e) => [e.id, e]));
  const locked = run.status === "paid";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
      <div className="grid grid-cols-[1.4fr_110px_80px_120px_110px_110px_110px_130px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
        <div>Employee</div>
        <div className="text-right">Gross</div>
        <div className="text-center">LOP</div>
        <div className="text-right">Earned</div>
        <div className="text-right">Incentive</div>
        <div className="text-right">Additions</div>
        <div className="text-right">Deductions</div>
        <div className="text-right">Net pay</div>
      </div>
      {lines.map((l) => {
        const e = empById.get(l.employee_id);
        const add = (l.additions ?? []).reduce((s, x) => s + x.amount, 0);
        const ded = (l.deductions ?? []).reduce((s, x) => s + x.amount, 0);
        return (
          <button
            key={l.id}
            onClick={() => !locked && setEditing(l)}
            className={`grid w-full grid-cols-[1.4fr_110px_80px_120px_110px_110px_110px_130px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 text-left last:border-0 ${
              locked ? "cursor-default" : "hover:bg-[#f6f8fb]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar name={e?.name ?? "—"} size={30} />
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-bold text-[#16203a]">
                  {e?.name ?? "—"}
                </div>
                <div className="truncate text-[10.5px] text-[#a3acbd]">{e?.designation || ""}</div>
              </div>
            </div>
            <div className="tf-num text-right text-[12.5px]">{money(l.monthly_gross)}</div>
            <div className="tf-num text-center text-[12.5px] font-bold">
              {l.lop_days ? (
                <span className="text-[#dc2626]">{l.lop_days}</span>
              ) : (
                <span className="text-[#c2cad8]">—</span>
              )}
            </div>
            <div className="tf-num text-right text-[12.5px]">{money(l.earned_gross)}</div>
            <div className="tf-num text-right text-[12.5px] font-bold text-[#8b5cf6]">
              {l.incentive ? money(l.incentive) : "—"}
            </div>
            <div className="tf-num text-right text-[12.5px] text-[#16a34a]">
              {add ? money(add) : "—"}
            </div>
            <div className="tf-num text-right text-[12.5px] text-[#dc2626]">
              {ded ? money(ded) : "—"}
            </div>
            <div className="tf-num text-right text-[13.5px] font-extrabold">{money(l.net_pay)}</div>
          </button>
        );
      })}
      {lines.length === 0 && (
        <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
          No active employees to pay.
        </div>
      )}

      {editing && (
        <LineModal
          line={editing}
          employee={empById.get(editing.employee_id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function LineModal({
  line,
  employee,
  onClose,
}: {
  line: PayrollLineRow;
  employee?: EmployeeRow;
  onClose: () => void;
}) {
  const [lopDays, setLopDays] = useState(line.lop_days);
  const [incentive, setIncentive] = useState(line.incentive);
  const [additions, setAdditions] = useState<PayLine[]>(line.additions ?? []);
  const [deductions, setDeductions] = useState<PayLine[]>(line.deductions ?? []);
  const [notes, setNotes] = useState(line.notes ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const calc = computeNet({
    monthlyGross: line.monthly_gross,
    totalDays: line.total_days,
    lopDays,
    incentive,
    additions,
    deductions,
  });

  const save = () =>
    start(async () => {
      const res = await updatePayrollLine(line.id, {
        lopDays,
        incentive,
        additions,
        deductions,
        notes,
      });
      if (res.ok) {
        toast.success(res.message || "Saved");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const rowsEditor = (
    title: string,
    rows: PayLine[],
    setRows: (f: (p: PayLine[]) => PayLine[]) => void,
    placeholder: string,
  ) => (
    <div>
      <div className="mb-1.5 text-[12px] font-extrabold text-[#16203a]">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-[1fr_120px_30px] items-center gap-2">
          <input
            value={r.label}
            onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            placeholder={placeholder}
            className={input}
          />
          <NumberInput
            value={r.amount}
            onChange={(n) => setRows((p) => p.map((x, j) => (j === i ? { ...x, amount: n } : x)))}
            className={input + " text-right"}
          />
          <button
            onClick={() => setRows((p) => p.filter((_, j) => j !== i))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#c2cad8] hover:text-[#dc2626]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => setRows((p) => [...p, { label: "", amount: 0 }])}
        className="flex items-center gap-1.5 rounded-[9px] bg-[#eef4fe] px-3 py-1.5 text-[12px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
      >
        <Plus size={13} /> Add line
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">
            {employee?.name ?? "Employee"} · payslip
          </h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[10px] bg-[#f8fafc] p-3">
              <div className="text-[10.5px] font-bold uppercase text-[#a3acbd]">Monthly gross</div>
              <div className="tf-num text-[14px] font-extrabold">{money(line.monthly_gross)}</div>
            </div>
            <label className={lbl}>
              Loss-of-pay days
              <NumberInput value={lopDays} onChange={setLopDays} className={input + " mt-1 font-normal"} />
            </label>
            <label className={lbl}>
              Incentive ₹
              <NumberInput value={incentive} onChange={setIncentive} className={input + " mt-1 font-normal"} />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-[#a3acbd]">
            LOP is pre-filled from approved unpaid leave. Incentive is pulled from the incentive
            plan (earned this year, minus what previous payslips already paid).
          </p>

          <div className="mt-4 grid grid-cols-2 gap-5">
            {rowsEditor("Additions", additions, setAdditions, "Bonus / reimbursement")}
            {rowsEditor("Deductions", deductions, setDeductions, "PF / PT / advance")}
          </div>

          <label className={lbl + " mt-4"}>
            Note on this payslip
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input + " mt-1 font-normal"} />
          </label>

          <div className="mt-4 space-y-1.5 rounded-[12px] bg-[#f8fafc] p-4 text-[13px]">
            <Row label={`Earned gross (${calc.payableDays} of ${line.total_days} days)`} value={money(calc.earnedGross)} />
            {incentive > 0 && <Row label="Incentive" value={money(incentive)} />}
            {calc.additionsTotal > 0 && <Row label="Additions" value={money(calc.additionsTotal)} />}
            {calc.deductionsTotal > 0 && (
              <Row label="Deductions" value={`- ${money(calc.deductionsTotal)}`} red />
            )}
            <div className="flex items-center justify-between border-t border-[#e3e8f0] pt-2">
              <span className="text-[13.5px] font-extrabold text-[#16203a]">Net pay</span>
              <span className="tf-num text-[17px] font-extrabold text-[#16a34a]">
                {money(calc.net)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#eef1f6] px-5 py-4">
          <a
            href={`/api/payslip/${line.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-[9px] border border-[#e6eaf1] px-4 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            <Download size={14} /> Payslip PDF
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={pending}
              className="flex items-center gap-2 rounded-[9px] bg-[#2a6fdb] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
            >
              <Save size={14} /> {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
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
