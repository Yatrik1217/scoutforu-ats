import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { leaveBalances } from "@/lib/hr";
import { fyStartYear, fyRange } from "@/lib/incentive";
import { hexA } from "@/lib/domain";
import {
  ApplyLeaveButton,
  LeaveStatusBadge,
  WithdrawLeaveButton,
} from "@/components/leave-manager";
import type { LeaveRequestRow, LeaveTypeRow, EmployeeRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtD = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM yy");

export default async function MyLeavePage() {
  await requireProfile();
  const sb = await createClient();
  const { data: emp } = await sb.from("employees").select("*").maybeSingle();
  const employee = emp as EmployeeRow | null;

  const [{ data: typeData }, { data: reqData }] = await Promise.all([
    sb.from("leave_types").select("*").eq("active", true).order("sort"),
    employee
      ? sb
          .from("leave_requests")
          .select("*")
          .eq("employee_id", employee.id)
          .order("from_date", { ascending: false })
      : Promise.resolve({ data: [] as LeaveRequestRow[] }),
  ]);
  const types = (typeData ?? []) as LeaveTypeRow[];
  const requests = (reqData ?? []) as LeaveRequestRow[];
  const typeById = new Map(types.map((t) => [t.id, t]));
  const range = fyRange(fyStartYear(new Date()));
  const balances = employee ? leaveBalances(types, requests, range) : [];

  if (!employee) {
    return (
      <div className="animate-sc-fadein p-[24px_26px_40px]">
        <h1 className="font-display text-[22px] font-extrabold text-[#16203a]">My Leave</h1>
        <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-6 text-[13px] font-semibold text-[#92400e]">
          No employee record is linked to your login yet. Ask the admin to add you under
          Employees and link your account — then your leave balance and payslips will appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            My Leave
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Your balance and requests for {range.label}
          </p>
        </div>
        <ApplyLeaveButton types={types} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        {balances.map((b) => (
          <div key={b.type.id} className="rounded-2xl border border-[#e9edf3] bg-white p-[18px]">
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-xl"
              style={{
                background: hexA(b.type.paid ? "#2a6fdb" : "#e8833a", 0.12),
                color: b.type.paid ? "#2a6fdb" : "#e8833a",
              }}
            >
              <CalendarDays size={16} />
            </div>
            <div className="font-display tf-num mt-3 text-[24px] font-extrabold tracking-tight">
              {b.type.paid ? b.remaining : b.taken}
              {b.type.paid && (
                <span className="text-[14px] font-bold text-[#a3acbd]"> / {b.quota}</span>
              )}
            </div>
            <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">{b.type.name}</div>
            <div className="text-[11px] font-medium text-[#a3acbd]">
              {b.type.paid ? `${b.taken} taken` : "taken (unpaid)"}
              {b.pending > 0 ? ` · ${b.pending} pending` : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[18px] overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1fr_190px_70px_1fr_150px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Type</div>
          <div>Dates</div>
          <div className="text-center">Days</div>
          <div>Reason</div>
          <div className="text-right">Status</div>
        </div>
        {requests.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1fr_190px_70px_1fr_150px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 last:border-0"
          >
            <div className="text-[12.5px] font-semibold text-[#42506b]">
              {typeById.get(r.leave_type_id)?.name ?? "—"}
            </div>
            <div className="tf-num text-[12px] font-semibold text-[#42506b]">
              {fmtD(r.from_date)}
              {r.from_date !== r.to_date ? ` – ${fmtD(r.to_date)}` : ""}
              {r.half_day && <span className="ml-1 text-[10px] text-[#8a94a6]">½</span>}
            </div>
            <div className="tf-num text-center text-[13px] font-extrabold">{r.days}</div>
            <div className="truncate text-[11.5px] text-[#7a8696]">{r.reason || "—"}</div>
            <div className="flex items-center justify-end gap-1">
              {r.status === "pending" && <WithdrawLeaveButton id={r.id} />}
              <LeaveStatusBadge status={r.status} />
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No leave requests yet.
          </div>
        )}
      </div>
    </div>
  );
}
