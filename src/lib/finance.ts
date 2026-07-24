// Finance domain helpers — P&L / EBITDA math and EMI scheduling.
// Safe for both server and client (no imports with side effects).
import { round2, toISODate } from "@/lib/invoice";
import type {
  FinanceExpenseRow,
  FinanceCategoryRow,
  FinanceEmiRow,
  FinancePaymentMethod,
} from "@/lib/database.types";

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

// Compute the next due date for an EMI given how many installments are paid.
// The first due date is on `due_day` of the start month (or the next month if
// the start day is already past the due day).
export function computeNextDue(
  emi: Pick<FinanceEmiRow, "start_date" | "due_day" | "paid_installments" | "total_installments" | "status">,
): string | null {
  if (emi.status === "closed") return null;
  if (emi.total_installments > 0 && emi.paid_installments >= emi.total_installments)
    return null;
  const start = new Date(emi.start_date + "T00:00:00");
  const first = dateOnDay(start.getFullYear(), start.getMonth(), emi.due_day);
  // if the loan started after the due day of its first month, first EMI is next month
  const baseMonthOffset = start.getDate() > emi.due_day ? 1 : 0;
  const idx = baseMonthOffset + emi.paid_installments;
  const due = dateOnDay(first.getFullYear(), first.getMonth() + idx, emi.due_day);
  return toISODate(due);
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

export function daysUntil(dateISO: string | null, today = new Date()): number | null {
  if (!dateISO) return null;
  return Math.round((+new Date(dateISO + "T00:00:00") - +startOfDay(today)) / 86_400_000);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Total of EMIs due within the next `days` (active loans only).
export function emisDueSoon(emis: FinanceEmiRow[], days = 30, today = new Date()): FinanceEmiRow[] {
  return emis
    .filter((e) => {
      if (e.status !== "active" || !e.next_due_date) return false;
      const d = daysUntil(e.next_due_date, today);
      return d !== null && d <= days;
    })
    .sort((a, b) => (a.next_due_date ?? "").localeCompare(b.next_due_date ?? ""));
}
