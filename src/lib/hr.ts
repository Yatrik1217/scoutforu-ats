// Employee portal helpers — leave maths and payroll computation.
// Safe for both server and client components.
import { round2, toISODate } from "@/lib/invoice";
import type {
  AttendanceSession,
  AttendanceSettingsRow,
  AttendanceRow,
  AttendanceStatus,
  EmployeeRow,
  LeaveRequestRow,
  LeaveTypeRow,
  PayLine,
  PayrollLineRow,
  LeaveStatus,
  PayrollStatus,
} from "@/lib/database.types";

export const LEAVE_STATUS_META: Record<LeaveStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#e8833a" },
  approved: { label: "Approved", color: "#16a34a" },
  rejected: { label: "Rejected", color: "#dc2626" },
  cancelled: { label: "Withdrawn", color: "#94a3b8" },
};

export const PAYROLL_STATUS_META: Record<PayrollStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#64748b" },
  finalised: { label: "Finalised", color: "#2a6fdb" },
  paid: { label: "Paid", color: "#16a34a" },
};

// ---- dates -------------------------------------------------------------------

export const monthStart = (d: Date) => toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
export const daysInMonth = (periodISO: string) => {
  const d = new Date(periodISO + "T00:00:00");
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
export const monthLabel = (periodISO: string) =>
  new Date(periodISO + "T00:00:00").toLocaleString("en-IN", { month: "long", year: "numeric" });

// Inclusive whole-day count between two dates.
export function dayCount(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + "T00:00:00");
  const b = new Date(toISO + "T00:00:00");
  return Math.max(0, Math.floor((+b - +a) / 86_400_000) + 1);
}

// How many days of a leave request fall inside a given month.
export function leaveDaysInMonth(req: LeaveRequestRow, periodISO: string): number {
  const mStart = new Date(periodISO + "T00:00:00");
  const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0);
  const from = new Date(req.from_date + "T00:00:00");
  const to = new Date(req.to_date + "T00:00:00");
  const start = from > mStart ? from : mStart;
  const end = to < mEnd ? to : mEnd;
  if (start > end) return 0;
  const overlap = Math.floor((+end - +start) / 86_400_000) + 1;
  const total = Math.floor((+to - +from) / 86_400_000) + 1;
  // Half-day requests are always a single day; otherwise prorate the request's
  // recorded days across the overlap (handles leave spanning a month boundary).
  if (req.half_day) return overlap > 0 ? req.days : 0;
  return total > 0 ? round2((req.days * overlap) / total) : 0;
}

// ---- probation ---------------------------------------------------------------

// Paid leave only unlocks after probation. Before that everything is unpaid.
export function probationEndsOn(
  employee: Pick<EmployeeRow, "joined_on" | "probation_months">,
): string | null {
  if (!employee.joined_on) return null;
  const months = employee.probation_months ?? 0;
  if (months <= 0) return null;
  const d = new Date(employee.joined_on + "T00:00:00");
  // Clamp to the last day of the target month — adding 3 months to 30 Nov must
  // land on 28 Feb, not overflow into March.
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

// True while the given date still falls inside the probation window.
export function onProbation(
  employee: Pick<EmployeeRow, "joined_on" | "probation_months">,
  onDateISO?: string,
): boolean {
  const ends = probationEndsOn(employee);
  if (!ends) return false;
  const when = onDateISO ?? toISODate(new Date());
  return when < ends;
}

// ---- leave balances ----------------------------------------------------------

export type LeaveBalance = {
  type: LeaveTypeRow;
  quota: number;
  taken: number; // approved
  pending: number;
  remaining: number;
  overQuota: number;
};

// Balances for one employee within a window (normally the financial year).
export function leaveBalances(
  types: LeaveTypeRow[],
  requests: LeaveRequestRow[],
  window: { from: string; to: string },
): LeaveBalance[] {
  const inWindow = requests.filter(
    (r) => r.from_date <= window.to && r.to_date >= window.from,
  );
  return types
    .filter((t) => t.active)
    .sort((a, b) => a.sort - b.sort)
    .map((type) => {
      const mine = inWindow.filter((r) => r.leave_type_id === type.id);
      const taken = round2(
        mine.filter((r) => r.status === "approved").reduce((s, r) => s + r.days, 0),
      );
      const pending = round2(
        mine.filter((r) => r.status === "pending").reduce((s, r) => s + r.days, 0),
      );
      const remaining = round2(Math.max(0, type.annual_quota - taken));
      return {
        type,
        quota: type.annual_quota,
        taken,
        pending,
        remaining,
        overQuota: round2(Math.max(0, taken - type.annual_quota)),
      };
    });
}

// ---- payroll -----------------------------------------------------------------

// Loss-of-pay days for a month = approved leave on UNPAID leave types.
// Paid leave taken beyond quota is surfaced separately on the employee page so
// it can be added as an explicit adjustment rather than silently docked.
export function lopDaysForMonth(
  requests: LeaveRequestRow[],
  types: LeaveTypeRow[],
  periodISO: string,
  attendance: AttendanceRow[] = [],
): number {
  const unpaid = new Set(types.filter((t) => !t.paid).map((t) => t.id));
  // Weight per calendar date, so a day that is BOTH marked absent and covered
  // by an unpaid-leave request is only ever docked once.
  const weight = new Map<string, number>();
  const bump = (date: string, w: number) =>
    weight.set(date, Math.max(weight.get(date) ?? 0, w));

  for (const r of requests) {
    if (r.status !== "approved" || !unpaid.has(r.leave_type_id)) continue;
    for (const d of datesInRange(r.from_date, r.to_date, periodISO))
      bump(d, r.half_day ? 0.5 : 1);
  }
  for (const a of attendance) {
    if (!a.on_date.startsWith(periodISO.slice(0, 7))) continue;
    if (a.status === "absent") bump(a.on_date, 1);
    else if (a.status === "half_day") bump(a.on_date, 0.5);
  }
  return round2([...weight.values()].reduce((s, w) => s + w, 0));
}

// Every date from..to that falls inside the given month.
function datesInRange(fromISO: string, toISO: string, periodISO: string): string[] {
  const month = periodISO.slice(0, 7);
  const out: string[] = [];
  const d = new Date(fromISO + "T00:00:00");
  const end = new Date(toISO + "T00:00:00");
  while (d <= end) {
    const iso = toISODate(d);
    if (iso.startsWith(month)) out.push(iso);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---- attendance ---------------------------------------------------------------

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; short: string; color: string }
> = {
  present: { label: "Present", short: "P", color: "#16a34a" },
  absent: { label: "Absent", short: "A", color: "#dc2626" },
  half_day: { label: "Half day", short: "H", color: "#e8833a" },
  leave: { label: "On leave", short: "L", color: "#2a6fdb" },
  week_off: { label: "Week off", short: "W", color: "#94a3b8" },
  holiday: { label: "Holiday", short: "HO", color: "#8b5cf6" },
};

// Order the grid cycles through when you click a day.
export const ATTENDANCE_CYCLE: AttendanceStatus[] = [
  "present",
  "absent",
  "half_day",
  "leave",
  "week_off",
  "holiday",
];

export function attendanceSummary(rows: AttendanceRow[]) {
  const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
  return {
    present: count("present"),
    absent: count("absent"),
    halfDay: count("half_day"),
    leave: count("leave"),
    weekOff: count("week_off"),
    holiday: count("holiday"),
  };
}

// ---- clock times & durations ---------------------------------------------------
//
// Everything is stored as a UTC timestamp. Formatting MUST pin the timezone —
// otherwise a server component renders UTC and a client component renders the
// browser's zone, and the same record shows two different times.
export const APP_TIMEZONE = "Asia/Kolkata";

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

// ---- work sessions --------------------------------------------------------------
//
// A day is a list of in/out sessions. Stepping out for tea and coming back is
// simply a new session — the gap between them is the break. Rows created before
// sessions existed fall back to their single check-in/check-out pair.
type TimeRow = Pick<AttendanceRow, "sessions" | "check_in_at" | "check_out_at">;

export function sessionsOf(row: TimeRow): AttendanceSession[] {
  const list = (row.sessions ?? []).filter((s) => s?.in);
  if (list.length) return list;
  return row.check_in_at ? [{ in: row.check_in_at, out: row.check_out_at }] : [];
}

// The session the person is currently inside, if any.
export function openSession(row: TimeRow): AttendanceSession | null {
  const list = sessionsOf(row);
  const last = list[list.length - 1];
  return last && !last.out ? last : null;
}

export const firstIn = (row: TimeRow): string | null => sessionsOf(row)[0]?.in ?? null;
export const lastOut = (row: TimeRow): string | null => {
  const list = sessionsOf(row);
  const last = list[list.length - 1];
  return last?.out ?? null;
};

// Time actually worked — the sessions added up. An open session counts to now.
export function workedMinutes(row: TimeRow, now = new Date()): number | null {
  const list = sessionsOf(row);
  if (!list.length) return null;
  let total = 0;
  for (const s of list) {
    const start = +new Date(s.in);
    const end = s.out ? +new Date(s.out) : +now;
    if (end > start) total += (end - start) / 60_000;
  }
  return Math.round(total);
}

// Arrival to departure, breaks included. Open day measures to now.
export function spanMinutes(row: TimeRow, now = new Date()): number | null {
  const start = firstIn(row);
  if (!start) return null;
  const end = openSession(row) ? +now : +new Date(lastOut(row) ?? start);
  const m = (end - +new Date(start)) / 60_000;
  return m > 0 ? Math.round(m) : 0;
}

// The gaps between sessions.
export function breakMinutes(row: TimeRow, now = new Date()): number {
  const span = spanMinutes(row, now);
  const worked = workedMinutes(row, now);
  if (span == null || worked == null) return 0;
  return Math.max(0, span - worked);
}

// Gross = arrival to departure. Only final once the day has ended.
export function grossMinutes(row: TimeRow): number | null {
  if (!firstIn(row)) return null;
  if (openSession(row)) return null;
  return spanMinutes(row);
}

// Net = time actually worked.
export function netMinutes(row: TimeRow): number | null {
  if (!firstIn(row)) return null;
  if (openSession(row)) return null;
  return workedMinutes(row);
}

// ---- standard shift (10–7) assessment ------------------------------------------
//
// Shift times are wall-clock IST. IST is a fixed +05:30 with no DST, so a
// date + "HH:MM" maps to one UTC instant without a timezone library.
const IST_OFFSET_MIN = 5 * 60 + 30;

export function istWallClockToUtcMs(dateISO: string, hhmm: string): number {
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [h, mi] = (hhmm || "00:00").split(":").map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MIN * 60_000;
}

export type ShiftSettings = Pick<
  AttendanceSettingsRow,
  "shift_start" | "shift_end" | "grace_minutes" | "full_day_hours" | "half_day_hours"
>;

export const DEFAULT_SHIFT: ShiftSettings = {
  shift_start: "10:00",
  shift_end: "19:00",
  grace_minutes: 10,
  full_day_hours: 8,
  half_day_hours: 4,
};

// Format a stored 'HH:MM' as e.g. "10:00 AM".
export function formatShiftTime(hhmm: string): string {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export type DayAssessment = {
  expectedMin: number; // shift window length
  lateMin: number; // arrival after start + grace
  earlyLeaveMin: number; // left before shift end (0 while still in)
  shortMin: number; // net worked below full-day target
  isFullDay: boolean;
  isHalfDay: boolean; // worked but under the full-day target
};

// Assess one day's sessions against the standard shift.
export function assessDay(
  row: TimeRow,
  settings: ShiftSettings = DEFAULT_SHIFT,
  now = new Date(),
): DayAssessment | null {
  const start = firstIn(row);
  if (!start) return null;
  const onDate = new Date(start).toISOString().slice(0, 10);
  const shiftStart = istWallClockToUtcMs(onDate, settings.shift_start);
  const shiftEnd = istWallClockToUtcMs(onDate, settings.shift_end);
  const expectedMin = Math.max(0, Math.round((shiftEnd - shiftStart) / 60_000));

  const lateMin = Math.max(
    0,
    Math.round((+new Date(start) - (shiftStart + settings.grace_minutes * 60_000)) / 60_000),
  );

  const out = lastOut(row);
  const stillIn = !!openSession(row);
  const earlyLeaveMin =
    stillIn || !out ? 0 : Math.max(0, Math.round((shiftEnd - +new Date(out)) / 60_000));

  const net = workedMinutes(row, now) ?? 0;
  const fullTarget = settings.full_day_hours * 60;
  const halfTarget = settings.half_day_hours * 60;
  const shortMin = stillIn ? 0 : Math.max(0, Math.round(fullTarget - net));

  return {
    expectedMin,
    lateMin,
    earlyLeaveMin,
    shortMin,
    isFullDay: net >= fullTarget,
    isHalfDay: net > 0 && net < fullTarget && net >= halfTarget,
  };
}

// Live figures for the card while the day is still running.
export function elapsedMinutes(
  row: TimeRow,
  now = new Date(),
): { gross: number; brk: number; net: number } | null {
  if (!firstIn(row)) return null;
  return {
    gross: spanMinutes(row, now) ?? 0,
    brk: breakMinutes(row, now),
    net: workedMinutes(row, now) ?? 0,
  };
}

export const sumLines = (rows: PayLine[] | null | undefined) =>
  round2((rows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0));

export function computeNet(input: {
  monthlyGross: number;
  totalDays: number;
  lopDays: number;
  incentive: number;
  additions: PayLine[];
  deductions: PayLine[];
}) {
  const total = Math.max(1, input.totalDays);
  const payableDays = Math.max(0, total - (input.lopDays || 0));
  const earnedGross = round2((input.monthlyGross * payableDays) / total);
  const add = sumLines(input.additions);
  const ded = sumLines(input.deductions);
  const net = round2(earnedGross + (input.incentive || 0) + add - ded);
  return { payableDays, earnedGross, additionsTotal: add, deductionsTotal: ded, net };
}

// Recompute a stored line (used after an edit).
export function recomputeLine(line: PayrollLineRow) {
  return computeNet({
    monthlyGross: line.monthly_gross,
    totalDays: line.total_days,
    lopDays: line.lop_days,
    incentive: line.incentive,
    additions: line.additions,
    deductions: line.deductions,
  });
}

// Incentive still owed = earned so far this financial year minus everything
// already carried on finalised/paid payroll lines. Self-correcting: a closure
// that qualifies late simply shows up in the next month's run.
export function incentiveDue(input: {
  earnedThisFY: number;
  alreadyPaid: number;
}): number {
  return round2(Math.max(0, input.earnedThisFY - input.alreadyPaid));
}

export function activeEmployees(rows: EmployeeRow[]): EmployeeRow[] {
  return rows.filter((e) => e.status === "active");
}
