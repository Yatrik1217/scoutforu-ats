"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2, toISODate } from "@/lib/invoice";
import {
  computeNet,
  dayCount,
  daysInMonth,
  lopDaysForMonth,
  approvedLeaveDates,
  unmarkedAbsentCount,
  weeklyOffDates,
  APP_TIMEZONE,
  monthLabel,
  incentiveDue,
  onProbation,
  probationEndsOn,
  openSession,
  sessionsOf,
  workedMinutes,
  formatDuration,
} from "@/lib/hr";
import { buildClosureStatement, buildRecruiterStats, fyStartYear, fyRange } from "@/lib/incentive";
import { placementBalance } from "@/lib/placement";
import { getCrmPersonAttendance } from "@/lib/crm-attendance";
import type {
  AttendanceRow,
  AttendanceStatus,
  EmployeeRow,
  LeaveRequestRow,
  LeaveTypeRow,
  PayLine,
  PayrollLineRow,
  PayrollRunRow,
  IncentiveSettingsRow,
  PlacementRow,
  PlacementPaymentRow,
  EmployeeEmploymentType,
  EmployeeAttendanceSource,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string; id?: string };

const refresh = () => revalidatePath("/", "layout");

async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, me: null };
  const { data: me } = await sb
    .from("profiles")
    .select("id,name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "master_admin") return { sb, me: null };
  return { sb, me };
}

async function currentUser() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  return { sb, userId: user?.id ?? null };
}

// ---- employees ---------------------------------------------------------------

export type EmployeeForm = {
  profileId: string | null;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  employmentType: EmployeeEmploymentType;
  attendanceSource: EmployeeAttendanceSource;
  crmUserId: string;
  dob: string | null;
  gender: string;
  address: string;
  emergencyName: string;
  emergencyPhone: string;
  joinedOn: string | null;
  probationMonths: number;
  monthlyGross: number;
  pan: string;
  bankAccount: string;
  bankIfsc: string;
  uan: string;
  notes: string;
};

export async function saveEmployee(id: string | null, form: EmployeeForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage employees." };
  if (!form.name.trim()) return { ok: false, error: "Employee name is required." };

  const payload = {
    profile_id: form.profileId,
    employee_code: form.employeeCode.trim(),
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    designation: form.designation.trim(),
    department: form.department.trim(),
    employment_type: form.employmentType,
    attendance_source: (form.attendanceSource === "crm" ? "crm" : "ats") as EmployeeAttendanceSource,
    crm_user_id: form.attendanceSource === "crm" ? form.crmUserId.trim() : "",
    dob: form.dob || null,
    gender: form.gender.trim(),
    address: form.address.trim(),
    emergency_name: form.emergencyName.trim(),
    emergency_phone: form.emergencyPhone.trim(),
    joined_on: form.joinedOn || null,
    probation_months: Math.max(0, Number(form.probationMonths) || 0),
    monthly_gross: Math.max(0, Number(form.monthlyGross) || 0),
    pan: form.pan.trim(),
    bank_account: form.bankAccount.trim(),
    bank_ifsc: form.bankIfsc.trim(),
    uan: form.uan.trim(),
    notes: form.notes.trim(),
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await sb.from("employees").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id, message: "Employee updated" };
  }
  const { data, error } = await sb.from("employees").insert(payload).select("id").single();
  if (error || !data) return { ok: false, error: error?.message || "Failed to add employee." };
  refresh();
  return { ok: true, id: data.id, message: "Employee added" };
}

export async function setEmployeeStatus(
  id: string,
  status: "active" | "exited",
  exitOn?: string | null,
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage employees." };
  const { error } = await sb
    .from("employees")
    .update({
      status,
      exit_on: status === "exited" ? (exitOn || new Date().toISOString().slice(0, 10)) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: status === "exited" ? "Marked as exited" : "Reactivated" };
}

// ---- leave types --------------------------------------------------------------

export async function saveLeaveType(
  id: string | null,
  input: { name: string; code: string; annualQuota: number; paid: boolean; active: boolean },
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage leave types." };
  if (!input.name.trim() || !input.code.trim())
    return { ok: false, error: "Name and short code are required." };
  const payload = {
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    annual_quota: Math.max(0, Number(input.annualQuota) || 0),
    paid: input.paid,
    active: input.active,
  };
  const { error } = id
    ? await sb.from("leave_types").update(payload).eq("id", id)
    : await sb.from("leave_types").insert(payload);
  if (error)
    return {
      ok: false,
      error: error.message.includes("duplicate")
        ? `Code ${payload.code} is already used.`
        : error.message,
    };
  refresh();
  return { ok: true, message: "Leave type saved" };
}

// ---- leave requests -----------------------------------------------------------

export async function applyForLeave(input: {
  employeeId?: string | null; // admin can file on someone's behalf
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  halfDay: boolean;
  reason: string;
}): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  if (!input.leaveTypeId) return { ok: false, error: "Pick a leave type." };
  if (!input.fromDate || !input.toDate) return { ok: false, error: "Pick the leave dates." };
  if (input.toDate < input.fromDate)
    return { ok: false, error: "The end date can't be before the start date." };

  const { data: me } = await sb.from("profiles").select("role").eq("id", userId).maybeSingle();
  const isAdmin = me?.role === "master_admin";

  let employeeId = input.employeeId ?? null;
  if (!employeeId || !isAdmin) {
    const { data: mine } = await sb
      .from("employees")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();
    if (!mine)
      return {
        ok: false,
        error: "No employee record is linked to your login — ask the admin to set one up.",
      };
    employeeId = mine.id;
  }

  const days = input.halfDay ? 0.5 : dayCount(input.fromDate, input.toDate);
  if (days <= 0) return { ok: false, error: "That date range is empty." };
  if (input.halfDay && input.fromDate !== input.toDate)
    return { ok: false, error: "A half day must be a single date." };

  // Probation gate: paid leave only unlocks once probation is complete.
  const [{ data: emp }, { data: type }] = await Promise.all([
    sb.from("employees").select("joined_on,probation_months").eq("id", employeeId).maybeSingle(),
    sb.from("leave_types").select("paid,name").eq("id", input.leaveTypeId).maybeSingle(),
  ]);
  if (emp && type?.paid && onProbation(emp, input.fromDate)) {
    const ends = probationEndsOn(emp);
    return {
      ok: false,
      error: `Paid leave starts after probation${ends ? ` (from ${ends})` : ""}. Apply this as Unpaid Leave (LWP) instead.`,
    };
  }

  const { error } = await sb.from("leave_requests").insert({
    employee_id: employeeId,
    leave_type_id: input.leaveTypeId,
    from_date: input.fromDate,
    to_date: input.toDate,
    days,
    half_day: input.halfDay,
    reason: input.reason.trim(),
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Leave applied for ${days} day${days === 1 ? "" : "s"}` };
}

export async function decideLeave(
  id: string,
  status: "approved" | "rejected",
  note = "",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can approve leave." };
  const { error } = await sb
    .from("leave_requests")
    .update({
      status,
      decided_by: me.id,
      decided_at: new Date().toISOString(),
      decision_note: note.trim(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: status === "approved" ? "Leave approved" : "Leave rejected" };
}

// An employee withdrawing their own pending request.
export async function withdrawLeave(id: string): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  const { error } = await sb
    .from("leave_requests")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Request withdrawn" };
}

// ---- attendance settings (standard shift) -------------------------------------

export async function updateAttendanceSettings(input: {
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  fullDayHours: number;
  halfDayHours: number;
  saturdayOffWeeks?: number[];
}): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can change work hours." };
  const hhmm = /^([01]?\d|2[0-3]):[0-5]\d$/;
  if (!hhmm.test(input.shiftStart) || !hhmm.test(input.shiftEnd))
    return { ok: false, error: "Enter times as HH:MM (24-hour), e.g. 10:00 and 19:00." };
  if (input.shiftEnd <= input.shiftStart)
    return { ok: false, error: "Shift end must be after the start." };

  const { error } = await sb
    .from("attendance_settings")
    .update({
      shift_start: input.shiftStart,
      shift_end: input.shiftEnd,
      grace_minutes: Math.max(0, Number(input.graceMinutes) || 0),
      full_day_hours: Math.max(0, Number(input.fullDayHours) || 0),
      half_day_hours: Math.max(0, Number(input.halfDayHours) || 0),
      ...(input.saturdayOffWeeks
        ? {
            saturday_off_weeks: [...new Set(input.saturdayOffWeeks)]
              .filter((n) => n >= 1 && n <= 5)
              .sort((a, b) => a - b),
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Work hours saved" };
}

// ---- attendance ----------------------------------------------------------------

async function myEmployee(sb: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await sb
    .from("employees")
    .select("id,name")
    .eq("profile_id", userId)
    .maybeSingle();
  return data;
}

// Self check-in for today. Creates today's row (or fills in the time if the
// admin already marked the day).
// Check in, or come back after stepping out. Each arrival is a new session.
export async function checkIn(): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  const me = await myEmployee(sb, userId);
  if (!me)
    return { ok: false, error: "No employee record is linked to your login — ask the admin." };

  const today = toISODate(new Date());
  const { data: existing } = await sb
    .from("attendance")
    .select("*")
    .eq("employee_id", me.id)
    .eq("on_date", today)
    .maybeSingle();
  const row = existing as AttendanceRow | null;

  if (row && openSession(row)) return { ok: false, error: "You're already checked in." };

  const now = new Date().toISOString();
  const sessions = [...(row ? sessionsOf(row) : []), { in: now, out: null }];
  const resuming = sessions.length > 1;

  const { error } = row
    ? await sb
        .from("attendance")
        .update({
          status: "present",
          sessions,
          check_in_at: row.check_in_at ?? now,
          check_out_at: null, // the day is running again
        })
        .eq("id", row.id)
    : await sb.from("attendance").insert({
        employee_id: me.id,
        on_date: today,
        status: "present",
        sessions,
        check_in_at: now,
      });
  if (error) return { ok: false, error: error.message };
  refresh();
  return {
    ok: true,
    message: resuming ? "Welcome back — clock running again" : "Checked in — have a good day",
  };
}

// The shift still running: today's row, or yesterday's if someone checked in
// before midnight and is checking out after it.
async function openShift(
  sb: Awaited<ReturnType<typeof createClient>>,
  employeeId: string,
) {
  const today = new Date();
  const yesterday = new Date(+today - 86_400_000);
  const { data } = await sb
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .in("on_date", [toISODate(today), toISODate(yesterday)])
    .not("check_in_at", "is", null)
    .is("check_out_at", null)
    .order("on_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as AttendanceRow | null;
}

// Step out — closes the current session. Coming back is just another check-in,
// so this is used for lunch, tea and leaving for the day alike.
export async function checkOut(): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  const me = await myEmployee(sb, userId);
  if (!me) return { ok: false, error: "No employee record is linked to your login." };

  const shift = await openShift(sb, me.id);
  if (!shift) return { ok: false, error: "You're not checked in." };

  const now = new Date().toISOString();
  const sessions = sessionsOf(shift).map((s, i, arr) =>
    i === arr.length - 1 && !s.out ? { ...s, out: now } : s,
  );

  const { error } = await sb
    .from("attendance")
    .update({ check_out_at: now, sessions })
    .eq("id", shift.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  const worked = workedMinutes({ ...shift, sessions, check_out_at: now });
  return { ok: true, message: `Stepped out — ${formatDuration(worked)} worked so far` };
}

// Admin marking a day on the register (also used to clear it).
export async function setAttendance(
  employeeId: string,
  onDate: string,
  status: AttendanceStatus | null,
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can edit the register." };

  if (status === null) {
    const { error } = await sb
      .from("attendance")
      .delete()
      .eq("employee_id", employeeId)
      .eq("on_date", onDate);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, message: "Cleared" };
  }

  const { data: existing } = await sb
    .from("attendance")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("on_date", onDate)
    .maybeSingle();
  const { error } = existing
    ? await sb.from("attendance").update({ status, marked_by: me.id }).eq("id", existing.id)
    : await sb
        .from("attendance")
        .insert({ employee_id: employeeId, on_date: onDate, status, marked_by: me.id });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

// ---- payroll ------------------------------------------------------------------

// How much incentive each employee has earned so far this financial year,
// according to whichever incentive scheme is configured.
async function incentiveEarnedByEmployee(
  sb: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, number>> {
  const [{ data: settingsData }, { data: plData }, { data: payData }, { data: team }] =
    await Promise.all([
      sb.from("incentive_settings").select("*").maybeSingle(),
      sb.from("placements").select("*"),
      sb.from("placement_payments").select("*"),
      sb.from("profiles").select("id,name,color,active,incentive_percent").neq("role", "client"),
    ]);
  const out = new Map<string, number>();
  const settings = (settingsData as IncentiveSettingsRow) ?? null;
  if (!settings) return out;

  const placements = (plData ?? []) as PlacementRow[];
  const payments = (payData ?? []) as PlacementPaymentRow[];
  const startYear = fyStartYear(new Date());

  if (settings.mode === "closure") {
    for (const r of team ?? []) {
      const st = buildClosureStatement({
        placements: placements.filter((p) => p.recruiter_id === r.id),
        settings,
        startYear,
      });
      out.set(r.id, st.total);
    }
  } else {
    const stats = buildRecruiterStats({
      recruiters: (team ?? []) as { id: string; name: string; color: string; active: boolean; incentive_percent: number | null }[],
      placements,
      payments,
      range: fyRange(startYear),
      settings,
      balanceOf: placementBalance,
    });
    for (const s of stats) out.set(s.id, s.incentive);
  }
  return out;
}

// Create (or reopen) the run for a month and build a line per active employee.
export async function createPayrollRun(periodMonth: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can run payroll." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodMonth))
    return { ok: false, error: "Pick a valid month." };
  const period = periodMonth.slice(0, 8) + "01";

  const { data: existing } = await sb
    .from("payroll_runs")
    .select("id,status")
    .eq("period_month", period)
    .maybeSingle();

  // A finalised or paid run is opened untouched — never rebuild locked numbers.
  if (existing && existing.status !== "draft")
    return { ok: true, id: existing.id, message: "Opening the existing run" };

  // Reuse the existing DRAFT run (so we can top it up with employees added since
  // it was first created) or create a fresh one.
  let runId = existing?.id ?? "";
  if (!runId) {
    const { data: run, error } = await sb
      .from("payroll_runs")
      .insert({ period_month: period, created_by: me.id })
      .select("id")
      .single();
    if (error || !run) return { ok: false, error: error?.message || "Could not create the run." };
    runId = run.id;
  }

  // Employees that already have a line in this run are left exactly as-is
  // (preserves any manual adjustments); we only add missing ones.
  const { data: existingLines } = await sb
    .from("payroll_lines")
    .select("employee_id")
    .eq("run_id", runId);
  const alreadyLined = new Set((existingLines ?? []).map((l) => l.employee_id));

  const monthEnd = toISODate(
    new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0),
  );
  const [{ data: emps }, { data: types }, { data: leaves }, { data: priorLines }, { data: att }, { data: settingsRow }, { data: holData }] =
    await Promise.all([
      sb.from("employees").select("*").eq("status", "active"),
      sb.from("leave_types").select("*"),
      sb.from("leave_requests").select("*").eq("status", "approved"),
      sb.from("payroll_lines").select("employee_id,incentive,run_id"),
      sb.from("attendance").select("*").gte("on_date", period).lte("on_date", monthEnd),
      sb.from("attendance_settings").select("weekly_offs,saturday_off_weeks").maybeSingle(),
      sb.from("holidays").select("on_date").gte("on_date", period).lte("on_date", monthEnd),
    ]);
  const attendance = (att ?? []) as AttendanceRow[];

  // Off days = weekly-off policy + holidays; un-marked working days are absent
  // and dock pay just like an explicit "absent" mark.
  const year = Number(period.slice(0, 4));
  const monthNo = Number(period.slice(5, 7));
  const monthDays = Array.from(
    { length: new Date(year, monthNo, 0).getDate() },
    (_, i) => toISODate(new Date(year, monthNo - 1, i + 1)),
  );
  const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const offDates = new Set<string>([
    ...weeklyOffDates(
      monthDays,
      (settingsRow?.weekly_offs as number[] | undefined) ?? [0],
      (settingsRow?.saturday_off_weeks as number[] | undefined) ?? [],
    ),
    ...((holData ?? []) as { on_date: string }[]).map((h) => h.on_date),
  ]);

  // Incentive already carried on finalised/paid runs, per employee.
  const { data: doneRuns } = await sb
    .from("payroll_runs")
    .select("id")
    .neq("status", "draft");
  const doneIds = new Set((doneRuns ?? []).map((r) => r.id));
  const paidIncentive = new Map<string, number>();
  for (const l of priorLines ?? []) {
    if (!doneIds.has(l.run_id)) continue;
    paidIncentive.set(l.employee_id, (paidIncentive.get(l.employee_id) ?? 0) + l.incentive);
  }

  const earned = await incentiveEarnedByEmployee(sb);
  const total = daysInMonth(period);
  const leaveTypes = (types ?? []) as LeaveTypeRow[];

  // Only build lines for active employees that don't already have one.
  const toBuild = ((emps ?? []) as EmployeeRow[]).filter((e) => !alreadyLined.has(e.id));
  const rows = [];
  for (const e of toBuild) {
    let lop: number;
    // A CRM-sourced employee (e.g. a salesperson who checks in from the CRM)
    // has no ATS attendance rows, so read their month from the CRM bridge and
    // dock only real Absent / Half-day days. Falls back to the ATS calculation
    // if the CRM blob can't be read.
    let crmLop: number | null = null;
    if (e.attendance_source === "crm" && e.crm_user_id) {
      const crm = await getCrmPersonAttendance(e.crm_user_id, monthDays, todayISO);
      if (crm) {
        let l = 0;
        for (const d of monthDays) {
          if (e.joined_on && d < e.joined_on) continue;
          if (e.exit_on && d > e.exit_on) continue;
          if (d > todayISO) continue;
          // Company holidays + weekly-offs (from the ATS holiday list) are paid,
          // even if the CRM's own config hasn't got them — the ATS list is the
          // single source of truth for payroll.
          if (offDates.has(d)) continue;
          const st = crm.statuses[d];
          // Absent = full loss of pay; leave for a CRM salesperson defaults to
          // LWP (unpaid) — a paid-leave case can be adjusted on the line.
          if (st === "absent" || st === "leave") l += 1;
          else if (st === "half_day") l += 0.5;
        }
        crmLop = round2(l);
      }
    }
    if (e.attendance_source === "crm" && e.crm_user_id) {
      // CRM employee: use the CRM loss-of-pay. If the CRM blob couldn't be read
      // (crmLop null) do NOT fall back to the ATS calc — they have no ATS
      // attendance, so it would wrongly dock the whole month. Default to no
      // in-month LOP (mid-month proration below still applies); the admin can
      // adjust the line if a real absence is missed.
      lop = crmLop ?? 0;
    } else {
      const mine = ((leaves ?? []) as LeaveRequestRow[]).filter((l) => l.employee_id === e.id);
      const myAtt = attendance.filter((a) => a.employee_id === e.id);
      const unmarked = unmarkedAbsentCount({
        monthDays,
        markedDates: new Set(myAtt.map((a) => a.on_date)),
        leaveDates: approvedLeaveDates(mine, period),
        offDates,
        joinedOn: e.joined_on,
        exitOn: e.exit_on,
        todayISO,
      });
      lop = lopDaysForMonth(mine, leaveTypes, period, myAtt) + unmarked;
    }
    // Prorate a mid-month joiner/leaver by CALENDAR days: every day in the month
    // before they joined (or after they left) is unpaid — including weekly-offs,
    // since salary is gross ÷ days-in-month and they weren't employed those days.
    // (Only new lines run this — existing lines are never recomputed.)
    let notEmployed = 0;
    for (const d of monthDays) {
      if ((e.joined_on && d < e.joined_on) || (e.exit_on && d > e.exit_on)) notEmployed++;
    }
    lop = round2(lop + notEmployed);
    const incentive = e.profile_id
      ? incentiveDue({
          earnedThisFY: earned.get(e.profile_id) ?? 0,
          alreadyPaid: paidIncentive.get(e.id) ?? 0,
        })
      : 0;
    const calc = computeNet({
      monthlyGross: e.monthly_gross,
      totalDays: total,
      lopDays: lop,
      incentive,
      additions: [],
      deductions: [],
    });
    rows.push({
      run_id: runId,
      employee_id: e.id,
      monthly_gross: e.monthly_gross,
      total_days: total,
      lop_days: lop,
      earned_gross: calc.earnedGross,
      incentive,
      additions: [],
      deductions: [],
      net_pay: calc.net,
    });
  }

  if (rows.length) {
    const { error: lineErr } = await sb.from("payroll_lines").insert(rows);
    if (lineErr) return { ok: false, error: lineErr.message };
  }
  refresh();
  const msg = existing
    ? rows.length
      ? `Synced — added ${rows.length} employee${rows.length === 1 ? "" : "s"}`
      : "All employees already in this run"
    : `${monthLabel(period)} payroll created`;
  return { ok: true, id: runId, message: msg };
}

export async function updatePayrollLine(
  lineId: string,
  input: {
    lopDays: number;
    incentive: number;
    additions: PayLine[];
    deductions: PayLine[];
    notes: string;
  },
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can run payroll." };
  const { data: line } = await sb
    .from("payroll_lines")
    .select("*, payroll_runs!inner(status)")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return { ok: false, error: "Payroll line not found." };
  const runStatus = (line as unknown as { payroll_runs: { status: string } }).payroll_runs.status;
  if (runStatus === "paid") return { ok: false, error: "This run is already paid." };

  const clean = (rows: PayLine[]) =>
    (rows ?? [])
      .map((r) => ({ label: (r.label ?? "").trim(), amount: round2(Number(r.amount) || 0) }))
      .filter((r) => r.label || r.amount);

  const additions = clean(input.additions);
  const deductions = clean(input.deductions);
  const l = line as unknown as PayrollLineRow;
  const calc = computeNet({
    monthlyGross: l.monthly_gross,
    totalDays: l.total_days,
    lopDays: Math.max(0, Number(input.lopDays) || 0),
    incentive: Math.max(0, Number(input.incentive) || 0),
    additions,
    deductions,
  });

  const { error } = await sb
    .from("payroll_lines")
    .update({
      lop_days: Math.max(0, Number(input.lopDays) || 0),
      incentive: Math.max(0, Number(input.incentive) || 0),
      additions,
      deductions,
      earned_gross: calc.earnedGross,
      net_pay: calc.net,
      notes: input.notes.trim(),
    })
    .eq("id", lineId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Saved" };
}

export async function setPayrollStatus(
  runId: string,
  status: "draft" | "finalised" | "paid",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can run payroll." };
  const patch: Partial<PayrollRunRow> = { status };
  if (status === "finalised") patch.finalised_at = new Date().toISOString();
  if (status === "paid") patch.paid_at = new Date().toISOString();
  if (status === "draft") {
    patch.finalised_at = null;
    patch.paid_at = null;
  }
  const { error } = await sb.from("payroll_runs").update(patch).eq("id", runId);
  if (error) return { ok: false, error: error.message };
  refresh();
  const msg =
    status === "paid"
      ? "Marked as paid — payslips are now visible to staff"
      : status === "finalised"
        ? "Finalised"
        : "Reopened as draft";
  return { ok: true, message: msg };
}

export async function deletePayrollRun(runId: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can run payroll." };
  const { data: run } = await sb
    .from("payroll_runs")
    .select("status")
    .eq("id", runId)
    .maybeSingle();
  if (!run) return { ok: false, error: "Run not found." };
  if (run.status === "paid")
    return { ok: false, error: "A paid run can't be deleted — reopen it first." };
  const { error } = await sb.from("payroll_runs").delete().eq("id", runId);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Payroll run deleted" };
}

// ---- holidays -----------------------------------------------------------------

export async function addHoliday(dateISO: string, name: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage holidays." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO))
    return { ok: false, error: "Pick a valid date." };
  const { error } = await sb
    .from("holidays")
    .upsert({ on_date: dateISO, name: name.trim() }, { onConflict: "on_date" });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: `Holiday added for ${dateISO}` };
}

export async function deleteHoliday(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage holidays." };
  const { error } = await sb.from("holidays").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Holiday removed" };
}
