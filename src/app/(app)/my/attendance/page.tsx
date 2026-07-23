import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/invoice";
import {
  attendanceSummary,
  monthStart,
  monthLabel,
  formatClock,
  formatDuration,
  breakMinutes,
  grossMinutes,
  netMinutes,
} from "@/lib/hr";
import { CheckInCard, AttendancePill } from "@/components/attendance-widgets";
import type { AttendanceRow, EmployeeRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function MyAttendancePage() {
  await requireProfile();
  const sb = await createClient();
  const { data: emp } = await sb.from("employees").select("*").maybeSingle();
  const employee = emp as EmployeeRow | null;

  const period = monthStart(new Date());
  const monthEnd = toISODate(
    new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0),
  );
  const { data: attData } = employee
    ? await sb
        .from("attendance")
        .select("*")
        .gte("on_date", period)
        .lte("on_date", monthEnd)
        .order("on_date", { ascending: false })
    : { data: [] as AttendanceRow[] };
  const rows = (attData ?? []) as AttendanceRow[];
  const today = rows.find((r) => r.on_date === toISODate(new Date())) ?? null;
  const sum = attendanceSummary(rows);

  if (!employee) {
    return (
      <div className="animate-sc-fadein p-[24px_26px_40px]">
        <h1 className="font-display text-[22px] font-extrabold text-[#16203a]">My Attendance</h1>
        <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-6 text-[13px] font-semibold text-[#92400e]">
          No employee record is linked to your login yet. Ask the admin to link your account under
          Employees.
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Present", value: sum.present, color: "#16a34a" },
    { label: "Half days", value: sum.halfDay, color: "#e8833a" },
    { label: "On leave", value: sum.leave, color: "#2a6fdb" },
    { label: "Absent", value: sum.absent, color: "#dc2626" },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          My Attendance
        </h1>
        <p className="text-[13px] text-[#8a94a6]">
          Check in when you start the day · {monthLabel(period)}
        </p>
      </div>

      <CheckInCard today={today} />

      <div className="mt-[18px] grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-[#e9edf3] bg-white p-[18px]">
            <div className="font-display tf-num text-[26px] font-extrabold" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-[18px] overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.1fr_105px_105px_90px_90px_90px_120px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Date</div>
          <div>Check in</div>
          <div>Check out</div>
          <div className="text-center">Break</div>
          <div className="text-center">Gross</div>
          <div className="text-center">Net</div>
          <div className="text-right">Status</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[1.1fr_105px_105px_90px_90px_90px_120px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-2.5 last:border-0"
          >
            <div className="text-[12.5px] font-bold text-[#16203a]">
              {format(new Date(r.on_date + "T00:00:00"), "EEE, dd MMM")}
            </div>
            <div className="tf-num text-[12px] text-[#42506b]">{formatClock(r.check_in_at)}</div>
            <div className="tf-num text-[12px] text-[#42506b]">{formatClock(r.check_out_at)}</div>
            <div className="tf-num text-center text-[12px] text-[#e8833a]">
              {r.check_in_at ? formatDuration(breakMinutes(r)) : "—"}
            </div>
            <div className="tf-num text-center text-[12px] font-bold text-[#2a6fdb]">
              {formatDuration(grossMinutes(r))}
            </div>
            <div className="tf-num text-center text-[12px] font-extrabold text-[#16a34a]">
              {formatDuration(netMinutes(r))}
            </div>
            <div className="text-right">
              <AttendancePill status={r.status} />
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            Nothing marked this month yet — check in above to start.
          </div>
        )}
      </div>
    </div>
  );
}
