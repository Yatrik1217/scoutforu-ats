"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, Ban, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { applyForLeave, decideLeave, withdrawLeave } from "@/lib/actions/hr";
import { LEAVE_STATUS_META, dayCount } from "@/lib/hr";
import { hexA } from "@/lib/domain";
import type { LeaveTypeRow, LeaveStatus } from "@/lib/database.types";

const input =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]";
const lbl = "block text-[12px] font-bold text-[#42506b]";

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const m = LEAVE_STATUS_META[status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: m.color, background: hexA(m.color, 0.12) }}
    >
      {m.label}
    </span>
  );
}

export function ApplyLeaveButton({
  types,
  employees,
  asAdmin,
  label = "Apply for leave",
}: {
  types: LeaveTypeRow[];
  employees?: { id: string; name: string }[];
  asAdmin?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.35)] hover:bg-[#245fc0]"
      >
        <Plus size={15} /> {label}
      </button>
      {open && (
        <ApplyModal
          types={types}
          employees={employees}
          asAdmin={asAdmin}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ApplyModal({
  types,
  employees,
  asAdmin,
  onClose,
}: {
  types: LeaveTypeRow[];
  employees?: { id: string; name: string }[];
  asAdmin?: boolean;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [employeeId, setEmployeeId] = useState(employees?.[0]?.id ?? "");
  const [leaveTypeId, setLeaveTypeId] = useState(types[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [halfDay, setHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const days = halfDay ? 0.5 : dayCount(fromDate, toDate);

  const submit = () =>
    start(async () => {
      const res = await applyForLeave({
        employeeId: asAdmin ? employeeId : null,
        leaveTypeId,
        fromDate,
        toDate: halfDay ? fromDate : toDate,
        halfDay,
        reason,
      });
      if (res.ok) {
        toast.success(res.message || "Applied");
        onClose();
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-[#16203a]">Apply for leave</h2>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">
          {asAdmin && employees && (
            <label className={lbl}>
              Employee
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className={input + " mt-1 font-normal"}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className={lbl + (asAdmin ? " mt-3" : "")}>
            Leave type
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className={input + " mt-1 font-normal"}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.paid ? "" : "(unpaid)"}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className={lbl}>
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (toDate < e.target.value) setToDate(e.target.value);
                }}
                className={input + " mt-1 font-normal"}
              />
            </label>
            <label className={lbl}>
              To
              <input
                type="date"
                value={halfDay ? fromDate : toDate}
                disabled={halfDay}
                onChange={(e) => setToDate(e.target.value)}
                className={input + " mt-1 font-normal disabled:opacity-50"}
              />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12px] font-bold text-[#42506b]">
            <input
              type="checkbox"
              checked={halfDay}
              onChange={(e) => setHalfDay(e.target.checked)}
              className="h-4 w-4 accent-[#2a6fdb]"
            />
            Half day
          </label>
          <label className={lbl + " mt-3"}>
            Reason
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className={input + " mt-1 resize-none font-normal"}
              placeholder="Optional"
            />
          </label>
          <div className="mt-3 rounded-[10px] bg-[#f8fafc] px-4 py-2.5 text-[12.5px] font-bold text-[#42506b]">
            Total: <span className="tf-num text-[#2a6fdb]">{days}</span> day
            {days === 1 ? "" : "s"}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-[9px] px-4 py-2 text-[13px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9]">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending || days <= 0}
              className="rounded-[9px] bg-[#2a6fdb] px-5 py-2 text-[13px] font-bold text-white hover:bg-[#245fc0] disabled:opacity-60"
            >
              {pending ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeaveDecisionButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (status: "approved" | "rejected") =>
    start(async () => {
      const res = await decideLeave(id, status);
      if (res.ok) {
        toast.success(res.message || "Done");
        router.refresh();
      } else toast.error(res.error || "Failed");
    });
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => act("approved")}
        disabled={pending}
        className="flex items-center gap-1 rounded-[8px] bg-[#e9f9ef] px-2.5 py-1.5 text-[11.5px] font-bold text-[#16a34a] hover:bg-[#d6f5e3] disabled:opacity-50"
      >
        <Check size={13} /> Approve
      </button>
      <button
        onClick={() => act("rejected")}
        disabled={pending}
        className="flex items-center gap-1 rounded-[8px] bg-[#fef2f2] px-2.5 py-1.5 text-[11.5px] font-bold text-[#dc2626] hover:bg-[#fde3e3] disabled:opacity-50"
      >
        <Ban size={13} /> Reject
      </button>
    </div>
  );
}

export function WithdrawLeaveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await withdrawLeave(id);
          if (res.ok) {
            toast.success(res.message || "Withdrawn");
            router.refresh();
          } else toast.error(res.error || "Failed");
        })
      }
      className="flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[11.5px] font-bold text-[#8a94a6] hover:bg-[#f1f4f9] disabled:opacity-50"
    >
      <Undo2 size={13} /> Withdraw
    </button>
  );
}
