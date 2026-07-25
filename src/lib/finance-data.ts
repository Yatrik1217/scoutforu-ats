// Server-side loaders for the Finance module. Reads the finance tables and,
// crucially, pulls ScoutforU's COLLECTED REVENUE straight from
// placement_payments so the company P&L needs no manual revenue entry.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/invoice";
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

export type PlacementRevenue = {
  grossFee: number; // professional fee earned, EXCLUDING GST — the P&L revenue line
  gst: number; // GST collected (a liability, not revenue)
  tds: number; // TDS the client deducted — advance tax, NOT an expense; below EBITDA
  collected: number; // cash actually recorded as received in the period
};

// Revenue for the company P&L, derived from PLACEMENT fields rather than from
// how a payment amount was typed — so it's correct whether you recorded the
// gross fee or the net-of-TDS receipt. Each payment is apportioned against the
// placement's net payable, then split into fee / GST / TDS using the placement's
// own figures. Attribution is by payment date, so it works month-wise and FY.
export async function loadPlacementRevenue(period: Period): Promise<PlacementRevenue> {
  const sb = await createClient();
  const { data: pays } = await sb
    .from("placement_payments")
    .select("amount,paid_on,placement_id")
    .gte("paid_on", period.from)
    .lte("paid_on", period.to);
  if (!pays || pays.length === 0) return { grossFee: 0, gst: 0, tds: 0, collected: 0 };

  const ids = [...new Set(pays.map((p) => p.placement_id).filter(Boolean))];
  const { data: places } = await sb
    .from("placements")
    .select("id,fee_amount,gst_amount,tds_amount,net_payable,total_fee")
    .in("id", ids);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));

  let grossFee = 0;
  let gst = 0;
  let tds = 0;
  let collected = 0;
  for (const pay of pays) {
    const amt = pay.amount || 0;
    collected += amt;
    const p = pay.placement_id ? byId.get(pay.placement_id) : undefined;
    if (!p) continue;
    // net_payable is what the client actually remits (total − TDS). Apportion this
    // payment against it, then split by the placement's fee/GST/TDS proportions.
    const base = p.net_payable && p.net_payable > 0 ? p.net_payable : p.total_fee || 0;
    const frac = base > 0 ? Math.min(1, amt / base) : 0;
    grossFee += frac * (p.fee_amount || 0);
    gst += frac * (p.gst_amount || 0);
    tds += frac * (p.tds_amount || 0);
  }
  return {
    grossFee: round2(grossFee),
    gst: round2(gst),
    tds: round2(tds),
    collected: round2(collected),
  };
}

// Same apportioning as loadPlacementRevenue, but bucketed by the YYYY-MM of each
// payment date — powers the month-by-month P&L table. Returns a map keyed
// "YYYY-MM".
export async function loadPlacementRevenueByMonth(
  period: Period,
): Promise<Map<string, PlacementRevenue>> {
  const sb = await createClient();
  const out = new Map<string, PlacementRevenue>();
  const { data: pays } = await sb
    .from("placement_payments")
    .select("amount,paid_on,placement_id")
    .gte("paid_on", period.from)
    .lte("paid_on", period.to);
  if (!pays || pays.length === 0) return out;

  const ids = [...new Set(pays.map((p) => p.placement_id).filter(Boolean))];
  const { data: places } = await sb
    .from("placements")
    .select("id,fee_amount,gst_amount,tds_amount,net_payable,total_fee")
    .in("id", ids);
  const byId = new Map((places ?? []).map((p) => [p.id, p]));

  for (const pay of pays) {
    const key = (pay.paid_on || "").slice(0, 7);
    if (!key) continue;
    const amt = pay.amount || 0;
    const cur = out.get(key) ?? { grossFee: 0, gst: 0, tds: 0, collected: 0 };
    cur.collected += amt;
    const p = pay.placement_id ? byId.get(pay.placement_id) : undefined;
    if (p) {
      const base = p.net_payable && p.net_payable > 0 ? p.net_payable : p.total_fee || 0;
      const frac = base > 0 ? Math.min(1, amt / base) : 0;
      cur.grossFee += frac * (p.fee_amount || 0);
      cur.gst += frac * (p.gst_amount || 0);
      cur.tds += frac * (p.tds_amount || 0);
    }
    out.set(key, cur);
  }
  for (const [k, v] of out) {
    out.set(k, {
      grossFee: round2(v.grossFee),
      gst: round2(v.gst),
      tds: round2(v.tds),
      collected: round2(v.collected),
    });
  }
  return out;
}
