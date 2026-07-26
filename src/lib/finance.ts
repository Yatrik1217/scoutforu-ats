// Finance domain helpers — P&L / EBITDA math and EMI scheduling.
// Safe for both server and client (no imports with side effects).
import { round2, toISODate } from "@/lib/invoice";
import type {
  FinanceExpenseRow,
  FinanceCategoryRow,
  FinanceEmiRow,
  FinancePaymentMethod,
  FinanceCommitmentType,
} from "@/lib/database.types";

// Short label for each commitment kind, used in the "money out" / dues lists.
export const COMMITMENT_LABEL: Record<FinanceCommitmentType, string> = {
  loan: "EMI",
  insurance: "Premium",
  sip: "SIP",
  bill: "Bill",
};

export const COMMITMENT_COLOR: Record<FinanceCommitmentType, string> = {
  loan: "#2a6fdb",
  insurance: "#b45309",
  sip: "#16a34a",
  bill: "#8b5cf6",
};

// Commitments that are recurring EXPENSES (paying them posts an expense line):
// loans, insurance premiums and general bills. SIPs are investments, not here.
export const EXPENSE_COMMITMENT_TYPES: FinanceCommitmentType[] = ["loan", "insurance", "bill"];

export const PAYMENT_METHOD_LABEL: Record<FinancePaymentMethod, string> = {
  bank_transfer: "Bank Transfer",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  auto_debit: "Auto-debit",
  other: "Other",
};

// ---- period helpers ----------------------------------------------------------
export type Period = { from: string; to: string; label: string };

export function monthPeriod(d = new Date()): Period {
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: toISODate(from),
    to: toISODate(to),
    label: from.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

// Indian financial year: 1 Apr – 31 Mar. Returns the FY containing `d`.
export function financialYearPeriod(d = new Date()): Period {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    from: `${y}-04-01`,
    to: `${y + 1}-03-31`,
    label: `FY ${y}–${String(y + 1).slice(2)}`,
  };
}

export function inPeriod(dateISO: string, p: Period): boolean {
  return dateISO >= p.from && dateISO <= p.to;
}

// Enumerate calendar months overlapping [fromISO, toISO] as {key,label,from,to}.
// Used for the month-by-month P&L table across a financial year.
export function monthsInRange(
  fromISO: string,
  toISO: string,
): { key: string; label: string; from: string; to: string }[] {
  const out: { key: string; label: string; from: string; to: string }[] = [];
  const end = new Date(toISO + "T00:00:00");
  let d = new Date(fromISO + "T00:00:00");
  d = new Date(d.getFullYear(), d.getMonth(), 1);
  while (d <= end) {
    const y = d.getFullYear();
    const m = d.getMonth();
    out.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: new Date(y, m, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      from: toISODate(new Date(y, m, 1)),
      to: toISODate(new Date(y, m + 1, 0)),
    });
    d = new Date(y, m + 1, 1);
  }
  return out;
}

// The due dates a recurring commitment should have between [fromISO, toISO] —
// one per month, on due_day (clamped to the month length), starting no earlier
// than the commitment's own start date. Powers "post all due payments".
export function duePaymentDates(
  c: { start_date: string; due_day: number },
  fromISO: string,
  toISO: string,
): string[] {
  const anchor = c.start_date > fromISO ? c.start_date : fromISO;
  if (anchor > toISO) return [];
  return monthsInRange(anchor, toISO)
    .map((mo) => {
      const [y, m] = mo.key.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate(); // day 0 of next month = last of this
      return toISODate(new Date(y, m - 1, Math.min(c.due_day, lastDay)));
    })
    // never emit a due date before the commitment actually started
    .filter((d) => d >= anchor);
}

// ---- P&L / EBITDA ------------------------------------------------------------
export type CategoryTotal = {
  categoryId: string | null;
  name: string;
  color: string;
  kind: "expense" | "income";
  ebitdaAddback: boolean;
  amount: number;
};

export type ProfitAndLoss = {
  revenue: number; // ScoutforU collected revenue + manual "other income"
  operatingExpenses: number; // expenses that count against EBITDA
  ebitda: number; // revenue − operatingExpenses
  addBacks: number; // interest + taxes + depreciation/amortisation
  netProfit: number; // ebitda − addBacks
  ebitdaMargin: number; // ebitda / revenue (0 when no revenue)
  netMargin: number;
  byCategory: CategoryTotal[]; // expense categories, largest first
};

// Build a P&L from expense/income rows + externally-supplied revenue (from
// ScoutforU placement receipts). Income rows add to revenue; expense rows are
// split into operating vs add-back (interest/tax/D&A) using the category flag.
export function computeProfitAndLoss(
  rows: FinanceExpenseRow[],
  categories: FinanceCategoryRow[],
  collectedRevenue: number,
): ProfitAndLoss {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, CategoryTotal>();

  let manualIncome = 0;
  let operatingExpenses = 0;
  let addBacks = 0;

  for (const r of rows) {
    const amt = round2(r.amount || 0);
    if (r.is_income) {
      manualIncome += amt;
      continue;
    }
    const cat = r.category_id ? catById.get(r.category_id) : undefined;
    const addback = cat?.ebitda_addback ?? false;
    if (addback) addBacks += amt;
    else operatingExpenses += amt;

    const key = r.category_id ?? "uncategorised";
    const existing = totals.get(key);
    if (existing) existing.amount = round2(existing.amount + amt);
    else
      totals.set(key, {
        categoryId: r.category_id,
        name: cat?.name ?? "Uncategorised",
        color: cat?.color ?? "#64748b",
        kind: "expense",
        ebitdaAddback: addback,
        amount: amt,
      });
  }

  const revenue = round2(collectedRevenue + manualIncome);
  const ebitda = round2(revenue - operatingExpenses);
  const netProfit = round2(ebitda - addBacks);
  const byCategory = [...totals.values()].sort((a, b) => b.amount - a.amount);

  return {
    revenue,
    operatingExpenses: round2(operatingExpenses),
    ebitda,
    addBacks: round2(addBacks),
    netProfit,
    ebitdaMargin: revenue > 0 ? ebitda / revenue : 0,
    netMargin: revenue > 0 ? netProfit / revenue : 0,
    byCategory,
  };
}

// Simple category totals (used for the personal breakdown, no EBITDA notion).
export function categoryTotals(
  rows: FinanceExpenseRow[],
  categories: FinanceCategoryRow[],
): { expenses: CategoryTotal[]; totalExpense: number; totalIncome: number } {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string, CategoryTotal>();
  let totalExpense = 0;
  let totalIncome = 0;
  for (const r of rows) {
    const amt = round2(r.amount || 0);
    if (r.is_income) {
      totalIncome += amt;
      continue;
    }
    totalExpense += amt;
    const cat = r.category_id ? catById.get(r.category_id) : undefined;
    const key = r.category_id ?? "uncategorised";
    const existing = totals.get(key);
    if (existing) existing.amount = round2(existing.amount + amt);
    else
      totals.set(key, {
        categoryId: r.category_id,
        name: cat?.name ?? "Uncategorised",
        color: cat?.color ?? "#64748b",
        kind: "expense",
        ebitdaAddback: cat?.ebitda_addback ?? false,
        amount: amt,
      });
  }
  return {
    expenses: [...totals.values()].sort((a, b) => b.amount - a.amount),
    totalExpense: round2(totalExpense),
    totalIncome: round2(totalIncome),
  };
}

// ---- EMI scheduling ----------------------------------------------------------
// Clamp a target day-of-month onto a given month (e.g. 31 → 30/28).
function dateOnDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

// The next calendar occurrence of `dueDay` on or after `fromISO`.
export function nextDueOnOrAfter(fromISO: string, dueDay: number): string {
  const from = new Date(fromISO + "T00:00:00");
  let d = dateOnDay(from.getFullYear(), from.getMonth(), dueDay);
  if (d < from) d = dateOnDay(from.getFullYear(), from.getMonth() + 1, dueDay);
  return toISODate(d);
}

// Next due date = the next occurrence of due_day on/after today (never in the
// past for an active commitment), but not before it has started. This is
// calendar-anchored — it does NOT drift with how many installments are paid,
// which is what users expect ("show me next month's date"). Returns null once a
// finite loan is fully paid or the commitment is closed.
export function computeNextDue(
  emi: Pick<FinanceEmiRow, "start_date" | "due_day" | "paid_installments" | "total_installments" | "status">,
  today = new Date(),
): string | null {
  if (emi.status === "closed") return null;
  if (emi.total_installments > 0 && emi.paid_installments >= emi.total_installments)
    return null;
  const todayISO = toISODate(startOfDay(today));
  const anchor = emi.start_date > todayISO ? emi.start_date : todayISO;
  return nextDueOnOrAfter(anchor, emi.due_day);
}

// After a payment, move the due date forward by one cycle: to the next
// occurrence of due_day strictly after the later of (current due, today).
export function advanceAfterPayment(
  currentNextDue: string | null,
  dueDay: number,
  today = new Date(),
): string {
  const todayISO = toISODate(startOfDay(today));
  const base = !currentNextDue || currentNextDue < todayISO ? todayISO : currentNextDue;
  const next = new Date(base + "T00:00:00");
  next.setDate(next.getDate() + 1);
  return nextDueOnOrAfter(toISODate(next), dueDay);
}

export function emiRemainingCount(emi: Pick<FinanceEmiRow, "total_installments" | "paid_installments">): number {
  if (emi.total_installments <= 0) return 0; // open-ended / untracked
  return Math.max(0, emi.total_installments - emi.paid_installments);
}

export function emiOutstanding(
  emi: Pick<FinanceEmiRow, "total_installments" | "paid_installments" | "emi_amount">,
): number {
  return round2(emiRemainingCount(emi) * (emi.emi_amount || 0));
}

export function emiProgress(emi: Pick<FinanceEmiRow, "total_installments" | "paid_installments">): number {
  if (emi.total_installments <= 0) return 0;
  return Math.min(1, emi.paid_installments / emi.total_installments);
}

// ---- investments (type = 'sip') ----------------------------------------------
// Amount put in so far: an optional starting lump (principal) plus every monthly
// contribution recorded (paid_installments × contribution).
export function investedAmount(
  emi: Pick<FinanceEmiRow, "principal" | "paid_installments" | "emi_amount">,
): number {
  return round2((emi.principal || 0) + emi.paid_installments * (emi.emi_amount || 0));
}

// Gain/loss of an investment = current value − amount invested.
export function investmentGain(
  emi: Pick<FinanceEmiRow, "principal" | "paid_installments" | "emi_amount" | "current_value">,
): { invested: number; value: number; gain: number; pct: number } {
  const invested = investedAmount(emi);
  const value = round2(emi.current_value || 0);
  const gain = round2(value - invested);
  return { invested, value, gain, pct: invested > 0 ? gain / invested : 0 };
}

// Roll up a set of investments into one portfolio summary.
export function portfolioSummary(emis: FinanceEmiRow[]): {
  invested: number;
  value: number;
  gain: number;
  pct: number;
  monthly: number;
} {
  const sips = emis.filter((e) => e.type === "sip");
  let invested = 0;
  let value = 0;
  let monthly = 0;
  for (const e of sips) {
    const g = investmentGain(e);
    invested += g.invested;
    value += g.value;
    if (e.status === "active") monthly += e.emi_amount || 0;
  }
  invested = round2(invested);
  value = round2(value);
  const gain = round2(value - invested);
  return { invested, value, gain, pct: invested > 0 ? gain / invested : 0, monthly: round2(monthly) };
}

export function daysUntil(dateISO: string | null, today = new Date()): number | null {
  if (!dateISO) return null;
  return Math.round((+new Date(dateISO + "T00:00:00") - +startOfDay(today)) / 86_400_000);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Loans & insurance premiums due within the next `days` (money going OUT).
// SIPs are investments, not bills, so they're excluded here.
export function emisDueSoon(emis: FinanceEmiRow[], days = 30, today = new Date()): FinanceEmiRow[] {
  return emis
    .filter((e) => {
      if (e.type === "sip" || e.status !== "active" || !e.next_due_date) return false;
      const d = daysUntil(e.next_due_date, today);
      return d !== null && d <= days;
    })
    .sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? ""));
}

// Every active commitment — loans, insurance premiums AND SIPs — with a due
// date in [fromISO, toISO]. This is the "cash leaving the account" view, so it
// deliberately INCLUDES SIPs (the money does go out, even if it buys an asset).
export function commitmentsDueBetween(
  emis: FinanceEmiRow[],
  fromISO: string,
  toISO: string,
): FinanceEmiRow[] {
  return emis
    .filter(
      (e) =>
        e.status === "active" &&
        !!e.next_due_date &&
        e.next_due_date >= fromISO &&
        e.next_due_date <= toISO,
    )
    .sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? ""));
}

// This month's SIP outflow (each active SIP contributes once a month).
export function monthlySipOutflow(emis: FinanceEmiRow[]): number {
  return round2(
    emis
      .filter((e) => e.type === "sip" && e.status === "active")
      .reduce((s, e) => s + (e.emi_amount || 0), 0),
  );
}
