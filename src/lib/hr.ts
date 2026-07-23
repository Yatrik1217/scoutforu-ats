// Employee portal helpers — leave maths and payroll computation.
// Safe for both server and client components.
import { round2, toISODate } from "@/lib/invoice";
import type {
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
): number {
  const unpaid = new Set(types.filter((t) => !t.paid).map((t) => t.id));
  return round2(
    requests
      .filter((r) => r.status === "approved" && unpaid.has(r.leave_type_id))
      .reduce((s, r) => s + leaveDaysInMonth(r, periodISO), 0),
  );
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
