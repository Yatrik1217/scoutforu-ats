import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toISODate } from "@/lib/invoice";
import { monthStart, monthLabel, lopDaysForMonth, attendanceSummary } from "@/lib/hr";
import { AttendanceGrid } from "@/components/attendance-widgets";
import { Avatar } from "@/components/bits";
import type {
  AttendanceRow,
  EmployeeRow,
  LeaveRequestRow,
  LeaveTypeRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/my/attendance");
  const { m } = await searchParams;

  const period = m ? `${m}-01` : monthStart(new Date());
  const year = Number(period.slice(0, 4));
  const monthNo = Number(period.slice(5, 7));
  const lastDay = new Date(year, monthNo, 0).getDate();
  const monthEnd = toISODate(new Date(year, monthNo, 0));
  const days = Array.from({ length: lastDay }, (_, i) =>
    toISODate(new Date(year, monthNo - 1, i + 1)),
  );

  const sb = await createClient();
  const [{ data: empData }, { data: attData }, { data: leaveData }, { data: typeData }] =
    await Promise.all([
      sb.from("employees").select("*").eq("status", "active").order("name"),
      sb.from("attendance").select("*").gte("on_date", period).lte("on_date", monthEnd),
      sb.from("leave_requests").select("*").eq("status", "approved"),
      sb.from("leave_types").select("*"),
    ]);

  const employees = (empData ?? []) as EmployeeRow[];
  const rows = (attData ?? []) as AttendanceRow[];
  const leaves = (leaveData ?? []) as LeaveRequestRow[];
  const types = (typeData ?? []) as LeaveTypeRow[];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Attendance
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            {monthLabel(period)} · staff check in themselves; you can correct any day here
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/attendance" className="flex items-center gap-2">
            <input
              type="month"
              name="m"
              defaultValue={period.slice(0, 7)}
              className="rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
            />
            <button className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]">
              Show
            </button>
          </form>
          <Link
            href="/payroll"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Payroll
          </Link>
        </div>
      </div>

      <AttendanceGrid
        employees={employees}
        rows={rows}
        days={days}
        month={monthLabel(period)}
      />

      {/* per-employee summary + the LOP payroll will use */}
      <div className="mt-[18px] overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.4fr_90px_90px_90px_90px_140px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Employee</div>
          <div className="text-center">Present</div>
          <div className="text-center">Half</div>
          <div className="text-center">Leave</div>
          <div className="text-center">Absent</div>
          <div className="text-right">Loss of pay</div>
        </div>
        {employees.map((e) => {
          const mine = rows.filter((r) => r.employee_id === e.id);
          const s = attendanceSummary(mine);
          const lop = lopDaysForMonth(
            leaves.filter((l) => l.employee_id === e.id),
            types,
            period,
            mine,
          );
          return (
            <div
              key={e.id}
              className="grid grid-cols-[1.4fr_90px_90px_90px_90px_140px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={e.name} size={30} />
                <div className="truncate text-[12.5px] font-bold text-[#16203a]">{e.name}</div>
              </div>
              <div className="tf-num text-center text-[13px] font-bold text-[#16a34a]">
                {s.present || "—"}
              </div>
              <div className="tf-num text-center text-[13px] font-bold text-[#e8833a]">
                {s.halfDay || "—"}
              </div>
              <div className="tf-num text-center text-[13px] font-bold text-[#2a6fdb]">
                {s.leave || "—"}
              </div>
              <div className="tf-num text-center text-[13px] font-bold text-[#dc2626]">
                {s.absent || "—"}
              </div>
              <div className="tf-num text-right text-[13px] font-extrabold">
                {lop ? `${lop} day${lop === 1 ? "" : "s"}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-[#8a94a6]">
        Loss of pay combines <b>absent / half days</b> marked here with <b>approved unpaid leave</b>
        {" "}— a day covered by both is only docked once. Payroll picks this up automatically when
        you create the run.
      </p>
    </div>
  );
}
