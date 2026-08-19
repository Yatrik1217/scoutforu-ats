import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  IdCard,
  Building2,
  CalendarCheck,
  CalendarDays,
  IndianRupee,
  Landmark,
  Phone,
  Mail,
  MapPin,
  UserCog,
  ExternalLink,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toISODate, money } from "@/lib/invoice";
import {
  monthStart,
  monthLabel,
  attendanceSummary,
  leaveBalances,
  formatShiftTime,
  APP_TIMEZONE,
  DEFAULT_SHIFT,
} from "@/lib/hr";
import { fyStartYear, fyRange } from "@/lib/incentive";
import { getCrmPersonAttendance } from "@/lib/crm-attendance";
import { Avatar } from "@/components/bits";
import type {
  AttendanceRow,
  AttendanceSettingsRow,
  EmployeeRow,
  LeaveRequestRow,
  LeaveTypeRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtDate = (d: string | null) =>
  d ? format(new Date(d + "T00:00:00"), "dd MMM yyyy") : "—";

const TYPE_LABEL: Record<string, string> = {
  full_time: "Full-time",
  contract: "Contract",
  intern: "Intern",
  part_time: "Part-time",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-[#16203a]">{value || "—"}</div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#e9edf3] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-extrabold text-[#16203a]">
          <Icon size={15} className="text-[#2a6fdb]" />
          {title}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, tone = "#16203a" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-[#eef1f6] bg-[#f8fafc] px-3 py-2.5 text-center">
      <div className="text-[18px] font-extrabold" style={{ color: tone }}>{value}</div>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-[#9aa4b6]">{label}</div>
    </div>
  );
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const sb = await createClient();

  const period = monthStart(new Date());
  const year = Number(period.slice(0, 4));
  const monthNo = Number(period.slice(5, 7));
  const lastDay = new Date(year, monthNo, 0).getDate();
  const monthEnd = toISODate(new Date(year, monthNo, 0));
  const days = Array.from({ length: lastDay }, (_, i) =>
    toISODate(new Date(year, monthNo - 1, i + 1)),
  );
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const fy = fyRange(fyStartYear(new Date()));

  const [{ data: empData }, { data: shiftData }, { data: typeData }, { data: loginData }] =
    await Promise.all([
      sb.from("employees").select("*").eq("id", id).maybeSingle(),
      sb.from("attendance_settings").select("*").maybeSingle(),
      sb.from("leave_types").select("*"),
      sb.from("profiles").select("id,name,email,role"),
    ]);
  if (!empData) notFound();
  const emp = empData as EmployeeRow;
  const shift = (shiftData as AttendanceSettingsRow) ?? DEFAULT_SHIFT;
  const types = (typeData ?? []) as LeaveTypeRow[];
  const login = (loginData ?? []).find((p) => p.id === emp.profile_id) as
    | { id: string; name: string; email: string; role: string }
    | undefined;

  const isCrm = emp.attendance_source === "crm";

  // Attendance & leave route by source: ATS staff read from this ATS; CRM
  // salespeople read read-only from the Outreach CRM blob.
  let attnSummary = { present: 0, absent: 0, halfDay: 0, leave: 0, weekOff: 0, holiday: 0 };
  let lateCount = 0;
  let leaveRows: LeaveRequestRow[] = [];
  let crmLinked = true;

  if (isCrm) {
    const crm = await getCrmPersonAttendance(emp.crm_user_id, days, todayISO);
    if (!crm) {
      crmLinked = false;
    } else {
      const s = crm.summary;
      attnSummary = { present: s.present, absent: s.absent, halfDay: s.halfDay, leave: s.leave, weekOff: 0, holiday: 0 };
      lateCount = s.late;
    }
  } else {
    const [{ data: attData }, { data: leaveData }] = await Promise.all([
      sb.from("attendance").select("*").eq("employee_id", id).gte("on_date", period).lte("on_date", monthEnd),
      sb.from("leave_requests").select("*").eq("employee_id", id).gte("from_date", fy.from).lte("from_date", fy.to),
    ]);
    attnSummary = attendanceSummary((attData ?? []) as AttendanceRow[]);
    leaveRows = (leaveData ?? []) as LeaveRequestRow[];
  }

  const balances = leaveBalances(types, leaveRows, { from: fy.from, to: fy.to });

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <Link href="/employees" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#8a94a6] hover:text-[#42506b]">
        <ArrowLeft size={14} /> All employees
      </Link>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e9edf3] bg-white p-5">
        <div className="flex items-center gap-4">
          <Avatar name={emp.name} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[20px] font-extrabold tracking-tight text-[#16203a]">{emp.name}</h1>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  emp.status === "active" ? "bg-[#e7f7ee] text-[#137a45]" : "bg-[#fdeaea] text-[#c0392b]"
                }`}
              >
                {emp.status === "active" ? "Active" : "Exited"}
              </span>
            </div>
            <div className="mt-0.5 text-[13px] text-[#8a94a6]">
              {emp.designation || "—"}
              {emp.department ? ` · ${emp.department}` : ""}
              {emp.employee_code ? ` · ${emp.employee_code}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12px] font-bold ${
              isCrm ? "bg-[#fff3e0] text-[#b26a00]" : "bg-[#eaf1fd] text-[#2a6fdb]"
            }`}
          >
            {isCrm ? "Attendance & leave in CRM" : "Attendance & leave in ATS"}
          </span>
          <Link
            href="/employees"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2 text-[12.5px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            <UserCog size={14} /> Edit
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Attendance & leave — this month */}
        <Card
          title={`Attendance · ${monthLabel(period)}`}
          icon={CalendarCheck}
          action={
            isCrm ? (
              <span className="text-[11px] font-bold text-[#b26a00]">Read-only from CRM</span>
            ) : (
              <Link href="/attendance" className="text-[11px] font-bold text-[#2a6fdb] hover:underline">
                Open Register
              </Link>
            )
          }
        >
          {isCrm && !crmLinked ? (
            <p className="rounded-[10px] border border-[#f2d9a8] bg-[#fff8ec] px-3 py-3 text-[12.5px] text-[#8a5a00]">
              This employee is set to record attendance in the CRM but no matching CRM user was found
              {emp.crm_user_id ? ` (id ${emp.crm_user_id})` : ""}. Link them from the Edit form.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <Stat label="Present" value={attnSummary.present} tone="#137a45" />
              <Stat label="Half day" value={attnSummary.halfDay} tone="#b26a00" />
              <Stat label="Leave" value={attnSummary.leave} tone="#2a6fdb" />
              <Stat label="Absent" value={attnSummary.absent} tone="#c0392b" />
              <Stat label="Late" value={lateCount} tone="#8a5a00" />
            </div>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#9aa4b6]">
            <CalendarDays size={13} /> Org shift {formatShiftTime(shift.shift_start)} – {formatShiftTime(shift.shift_end)}
            <span className="text-[#c7cede]">·</span> grace {shift.grace_minutes ?? DEFAULT_SHIFT.grace_minutes}m
          </div>
        </Card>

        {/* Leave balance (ATS only — CRM leave lives in the CRM) */}
        <Card title={`Leave balance · ${fy.label}`} icon={CalendarDays}>
          {isCrm ? (
            <p className="rounded-[10px] border border-[#f2d9a8] bg-[#fff8ec] px-3 py-3 text-[12.5px] text-[#8a5a00]">
              Leave for CRM staff is applied for and tracked inside the Outreach CRM.
            </p>
          ) : balances.length === 0 ? (
            <p className="text-[12.5px] text-[#9aa4b6]">No leave types configured.</p>
          ) : (
            <div className="space-y-2">
              {balances.map((b) => (
                <div key={b.type.id} className="flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-[#42506b]">
                    {b.type.name}
                    {!b.type.paid && <span className="ml-1 text-[11px] text-[#9aa4b6]">(unpaid)</span>}
                  </span>
                  <span className="text-[#16203a]">
                    <b>{b.remaining}</b>
                    <span className="text-[#9aa4b6]"> / {b.quota} left</span>
                    {b.pending > 0 && <span className="ml-2 text-[11px] text-[#b26a00]">{b.pending} pending</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Personal */}
        <Card title="Personal" icon={IdCard}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Phone" value={emp.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} />{emp.phone}</span> : "—"} />
            <Field label="Email" value={emp.email ? <span className="inline-flex items-center gap-1 break-all"><Mail size={12} />{emp.email}</span> : "—"} />
            <Field label="Date of birth" value={fmtDate(emp.dob)} />
            <Field label="Gender" value={emp.gender} />
            <Field label="Address" value={emp.address ? <span className="inline-flex items-start gap-1"><MapPin size={12} className="mt-0.5" />{emp.address}</span> : "—"} />
            <Field label="Emergency contact" value={emp.emergency_name ? `${emp.emergency_name}${emp.emergency_phone ? ` · ${emp.emergency_phone}` : ""}` : "—"} />
          </div>
        </Card>

        {/* Employment */}
        <Card title="Employment" icon={Building2}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Employee code" value={emp.employee_code} />
            <Field label="Type" value={TYPE_LABEL[emp.employment_type] ?? emp.employment_type} />
            <Field label="Date of joining" value={fmtDate(emp.joined_on)} />
            <Field label="Probation" value={emp.probation_months ? `${emp.probation_months} months` : "None"} />
            {emp.status === "exited" && <Field label="Exited on" value={fmtDate(emp.exit_on)} />}
            <Field
              label="ATS login"
              value={
                login ? (
                  <span className="inline-flex items-center gap-1">{login.name}<span className="text-[11px] font-normal text-[#9aa4b6]">({login.role})</span></span>
                ) : (
                  <span className="text-[#9aa4b6]">No login</span>
                )
              }
            />
            {isCrm && <Field label="CRM user id" value={emp.crm_user_id || <span className="text-[#c0392b]">not linked</span>} />}
          </div>
        </Card>

        {/* Compensation */}
        <Card title="Compensation" icon={IndianRupee}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Monthly gross" value={<span className="text-[15px]">{money(emp.monthly_gross)}</span>} />
            <Field label="Annual (12×)" value={money(emp.monthly_gross * 12)} />
          </div>
          {emp.status === "active" && emp.profile_id && (
            <Link href="/payroll" className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-bold text-[#2a6fdb] hover:underline">
              <ExternalLink size={12} /> View in payroll
            </Link>
          )}
        </Card>

        {/* Statutory & bank */}
        <Card title="Statutory & bank" icon={Landmark}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="PAN" value={emp.pan} />
            <Field label="UAN (PF)" value={emp.uan} />
            <Field label="Bank account" value={emp.bank_account} />
            <Field label="IFSC" value={emp.bank_ifsc} />
          </div>
        </Card>
      </div>

      {emp.notes && (
        <div className="mt-4 rounded-2xl border border-[#e9edf3] bg-white p-5">
          <div className="mb-2 text-[13px] font-extrabold text-[#16203a]">Notes</div>
          <p className="whitespace-pre-wrap text-[13px] text-[#42506b]">{emp.notes}</p>
        </div>
      )}
    </div>
  );
}
