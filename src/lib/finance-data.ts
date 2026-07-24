// Server-side loaders for the Finance module. Reads the finance tables and,
// crucially, pulls ScoutforU's COLLECTED REVENUE straight from
// placement_payments so the company P&L needs no manual revenue entry.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  FinanceCategoryRow,
  FinanceExpenseRow,
  FinanceEmiRow,
  FinanceScope,
} from "@/lib/database.types";
import type { Period } from "@/lib/finance";

export type FinanceData = {
  categories: FinanceCategoryRow[];
  expenses: FinanceExpenseRow[];
  emis: FinanceEmiRow[];
};

// Load categories + emis (all) and expenses for a scope, optionally within a
// period. Pass scope to fetch just personal or company.
export async function loadFinance(
  scope?: FinanceScope,
  period?: Period,
): Promise<FinanceData> {
  const sb = await createClient();

  let expenseQ = sb.from("finance_expenses").select("*").order("txn_date", { ascending: false });
  let catQ = sb.from("finance_categories").select("*").order("sort");
  let emiQ = sb.from("finance_emis").select("*").order("next_due_date", { nullsFirst: false });
  if (scope) {
    expenseQ = expenseQ.eq("scope", scope);
    catQ = catQ.eq("scope", scope);
    emiQ = emiQ.eq("scope", scope);
  }
  if (period) {
    expenseQ = expenseQ.gte("txn_date", period.from).lte("txn_date", period.to);
  }

  const [{ data: expenses }, { data: categories }, { data: emis }] = await Promise.all([
    expenseQ,
    catQ,
    emiQ,
  ]);

  return {
    categories: (categories ?? []) as FinanceCategoryRow[],
    expenses: (expenses ?? []) as FinanceExpenseRow[],
    emis: (emis ?? []) as FinanceEmiRow[],
  };
}

// ScoutforU cash actually collected within [from,to] — the revenue line for the
// company P&L. Sums payments recorded against placements (the truth source for
// received money; invoices are the billing layer generated from these).
export async function loadCollectedRevenue(period: Period): Promise<number> {
  const sb = await createClient();
  const { data } = await sb
    .from("placement_payments")
    .select("amount,paid_on")
    .gte("paid_on", period.from)
    .lte("paid_on", period.to);
  return (data ?? []).reduce((sum, p) => sum + (p.amount || 0), 0);
}
