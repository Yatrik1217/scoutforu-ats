"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2, toISODate } from "@/lib/invoice";
import {
  computeNet,
  dayCount,
  daysInMonth,
  lopDaysForMonth,
  monthLabel,
  incentiveDue,
  onProbation,
  probationEndsOn,
} from "@/lib/hr";
import { buildClosureStatement, buildRecruiterStats, fyStartYear, fyRange } from "@/lib/incentive";
import { placementBalance } from "@/lib/placement";
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
export async function checkIn(): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  const me = await myEmployee(sb, userId);
  if (!me)
    return { ok: false, error: "No employee record is linked to your login — ask the admin." };

  const today = toISODate(new Date());
  const { data: existing } = await sb
    .from("attendance")
    .select("id,check_in_at")
    .eq("employee_id", me.id)
    .eq("on_date", today)
    .maybeSingle();

  if (existing?.check_in_at) return { ok: false, error: "You've already checked in today." };

  const now = new Date().toISOString();
  const { error } = existing
    ? await sb
        .from("attendance")
        .update({ status: "present", check_in_at: now })
        .eq("id", existing.id)
    : await sb.from("attendance").insert({
        employee_id: me.id,
        on_date: today,
        status: "present",
        check_in_at: now,
      });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Checked in — have a good day" };
}

export async function checkOut(): Promise<Result> {
  const { sb, userId } = await currentUser();
  if (!userId) return { ok: false, error: "Not signed in." };
  const me = await myEmployee(sb, userId);
  if (!me) return { ok: false, error: "No employee record is linked to your login." };

  const today = toISODate(new Date());
  const { data: existing } = await sb
    .from("attendance")
    .select("id,check_in_at,check_out_at")
    .eq("employee_id", me.id)
    .eq("on_date", today)
    .maybeSingle();
  if (!existing?.check_in_at) return { ok: false, error: "Check in first." };
  if (existing.check_out_at) return { ok: false, error: "You've already checked out today." };

  const { error } = await sb
    .from("attendance")
    .update({ check_out_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Checked out" };
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
  if (existing) return { ok: true, id: existing.id, message: "Opening the existing run" };

  const { data: run, error } = await sb
    .from("payroll_runs")
    .insert({ period_month: period, created_by: me.id })
    .select("id")
    .single();
  if (error || !run) return { ok: false, error: error?.message || "Could not create the run." };

  const monthEnd = toISODate(
    new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0),
  );
  const [{ data: emps }, { data: types }, { data: leaves }, { data: priorLines }, { data: att }] =
    await Promise.all([
      sb.from("employees").select("*").eq("status", "active"),
      sb.from("leave_types").select("*"),
      sb.from("leave_requests").select("*").eq("status", "approved"),
      sb.from("payroll_lines").select("employee_id,incentive,run_id"),
      sb.from("attendance").select("*").gte("on_date", period).lte("on_date", monthEnd),
    ]);
  const attendance = (att ?? []) as AttendanceRow[];

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

  const rows = ((emps ?? []) as EmployeeRow[]).map((e) => {
    const mine = ((leaves ?? []) as LeaveRequestRow[]).filter((l) => l.employee_id === e.id);
    const lop = lopDaysForMonth(
      mine,
      leaveTypes,
      period,
      attendance.filter((a) => a.employee_id === e.id),
    );
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
    return {
      run_id: run.id,
      employee_id: e.id,
      monthly_gross: e.monthly_gross,
      total_days: total,
      lop_days: lop,
      earned_gross: calc.earnedGross,
      incentive,
      additions: [],
      deductions: [],
      net_pay: calc.net,
    };
  });

  if (rows.length) {
    const { error: lineErr } = await sb.from("payroll_lines").insert(rows);
    if (lineErr) return { ok: false, error: lineErr.message };
  }
  refresh();
  return { ok: true, id: run.id, message: `${monthLabel(period)} payroll created` };
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
