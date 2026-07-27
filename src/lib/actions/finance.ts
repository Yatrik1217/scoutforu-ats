"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/invoice";
import { computeNextDue, advanceAfterPayment, duePaymentDates, nextDueOnOrAfter } from "@/lib/finance";
import type {
  FinanceScope,
  FinanceCategoryKind,
  FinancePaymentMethod,
  FinanceEmiStatus,
  FinanceCommitmentType,
  FinanceEmiRow,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string; id?: string };

function refresh() {
  revalidatePath("/", "layout");
}

// Finance is Master-Admin-only; RLS enforces it, this gives a clear message.
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

// Pick a sensible default category for a commitment that was saved without one,
// so its posted payments are never "Uncategorised". Matches by name within the
// same book; returns null only if nothing suitable exists.
async function resolveCategoryId(
  sb: Awaited<ReturnType<typeof createClient>>,
  scope: FinanceScope,
  type: FinanceCommitmentType,
  chosen: string | null,
): Promise<string | null> {
  if (chosen) return chosen;
  const needles =
    type === "loan"
      ? ["emi", "loan"]
      : type === "sip"
        ? ["sip", "invest"]
        : type === "insurance"
          ? ["insurance", "term"]
          : ["other operating", "other"]; // bill
  const { data } = await sb
    .from("finance_categories")
    .select("id,name")
    .eq("scope", scope)
    .eq("kind", "expense")
    .eq("archived", false);
  for (const n of needles) {
    const hit = (data ?? []).find((c) => c.name.toLowerCase().includes(n));
    if (hit) return hit.id;
  }
  return null;
}

// ---- expenses / income lines -------------------------------------------------
export type ExpenseForm = {
  scope: FinanceScope;
  categoryId: string | null;
  isIncome: boolean;
  title: string;
  amount: number;
  txnDate: string;
  paymentMethod: FinancePaymentMethod;
  payee: string;
  notes: string;
};

export async function saveExpense(id: string | null, form: ExpenseForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  if (!form.title.trim()) return { ok: false, error: "A description is required." };
  if (!(form.amount > 0)) return { ok: false, error: "Enter an amount greater than zero." };
  if (!form.txnDate) return { ok: false, error: "Pick a date." };

  const payload = {
    scope: form.scope,
    category_id: form.categoryId,
    is_income: form.isIncome,
    title: form.title.trim(),
    amount: round2(form.amount),
    txn_date: form.txnDate,
    payment_method: form.paymentMethod,
    payee: form.payee.trim(),
    notes: form.notes.trim(),
    updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await sb.from("finance_expenses").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id, message: "Entry updated" };
  }
  const { data, error } = await sb
    .from("finance_expenses")
    .insert({ ...payload, created_by: me.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Failed to save entry." };
  refresh();
  return { ok: true, id: data.id, message: form.isIncome ? "Income recorded" : "Expense recorded" };
}

export async function deleteExpense(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  // Don't orphan-delete an EMI installment mirror without unwinding the count.
  const { data: row } = await sb
    .from("finance_expenses")
    .select("emi_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await sb.from("finance_expenses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  if (row?.emi_id) {
    const { data: emi } = await sb
      .from("finance_emis")
      .select("*")
      .eq("id", row.emi_id)
      .maybeSingle();
    if (emi) {
      const paid = Math.max(0, emi.paid_installments - 1);
      const next = computeNextDue({ ...emi, paid_installments: paid });
      await sb
        .from("finance_emis")
        .update({
          paid_installments: paid,
          next_due_date: next,
          status: emi.status === "closed" ? "active" : emi.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", emi.id);
    }
  }
  refresh();
  return { ok: true, message: "Entry deleted" };
}

// ---- mutual-fund NAV sync ----------------------------------------------------
export type FundHit = { schemeCode: string; schemeName: string };

// Search AMFI mutual funds (proxied server-side to avoid CORS). Robust to
// app-style names: strips "(Reg)"/"(G)" and punctuation, retries with fewer
// words, ranks Growth/Regular plans first, and accepts a scheme code pasted
// directly (all-digits).
async function mfapiSearch(q: string): Promise<FundHit[]> {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { schemeCode: number; schemeName: string }[];
    return (data ?? []).map((d) => ({ schemeCode: String(d.schemeCode), schemeName: d.schemeName }));
  } catch {
    return [];
  }
}

export async function searchFunds(query: string): Promise<FundHit[]> {
  const raw = query.trim();
  if (raw.length < 3) return [];

  // pasted AMFI scheme code → look it up directly
  if (/^\d{4,}$/.test(raw)) {
    try {
      const res = await fetch(`https://api.mfapi.in/mf/${raw}`, { next: { revalidate: 86400 } });
      if (res.ok) {
        const j = (await res.json()) as { meta?: { scheme_name?: string } };
        if (j?.meta?.scheme_name) return [{ schemeCode: raw, schemeName: j.meta.scheme_name }];
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  // drop "(Reg)"/"(G)"/"(Direct)" etc + punctuation, then search on the words
  const cleaned = raw.replace(/\([^)]*\)/g, " ").replace(/[^\w\s&]/g, " ").replace(/\s+/g, " ").trim();
  const tokens = cleaned.split(" ").filter(Boolean);

  let hits = await mfapiSearch(cleaned);
  if (hits.length === 0 && tokens.length > 3) hits = await mfapiSearch(tokens.slice(0, 3).join(" "));
  if (hits.length === 0 && tokens.length > 2) hits = await mfapiSearch(tokens.slice(0, 2).join(" "));

  // surface Growth + Regular (typical SIP) plans first, IDCW/dividend last
  const rank = (name: string) => {
    const n = name.toLowerCase();
    let s = 0;
    if (n.includes("growth")) s -= 2;
    if (n.includes("regular")) s -= 1;
    if (n.includes("idcw") || n.includes("dividend") || n.includes("payout")) s += 3;
    return s;
  };
  hits.sort((a, b) => rank(a.schemeName) - rank(b.schemeName));
  return hits.slice(0, 25);
}

// Bust the cached NAVs so the Investments page pulls fresh quotes.
export async function refreshNavs(): Promise<Result> {
  const { me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  revalidatePath("/finance/investments", "page");
  return { ok: true, message: "NAVs refreshed" };
}

// ---- categories --------------------------------------------------------------
export type CategoryForm = {
  scope: FinanceScope;
  name: string;
  kind: FinanceCategoryKind;
  color: string;
  ebitdaAddback: boolean;
  sort: number;
};

export async function saveCategory(id: string | null, form: CategoryForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  if (!form.name.trim()) return { ok: false, error: "Category name is required." };
  const payload = {
    scope: form.scope,
    name: form.name.trim(),
    kind: form.kind,
    color: form.color,
    ebitda_addback: form.kind === "expense" ? form.ebitdaAddback : false,
    sort: form.sort || 0,
  };
  if (id) {
    const { error } = await sb.from("finance_categories").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id, message: "Category updated" };
  }
  const { data, error } = await sb
    .from("finance_categories")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Failed to save category." };
  refresh();
  return { ok: true, id: data.id, message: "Category added" };
}

export async function archiveCategory(id: string, archived: boolean): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { error } = await sb.from("finance_categories").update({ archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: archived ? "Category archived" : "Category restored" };
}

// ---- EMIs / loans ------------------------------------------------------------
export type EmiForm = {
  scope: FinanceScope;
  type: FinanceCommitmentType;
  name: string;
  lender: string;
  categoryId: string | null;
  principal: number;
  currentValue: number;
  schemeCode: string | null;
  units: number;
  emiAmount: number;
  interestRate: number;
  totalInstallments: number;
  paidInstallments: number;
  startDate: string;
  dueDay: number;
  status: FinanceEmiStatus;
  notes: string;
};

const TYPE_NOUN: Record<FinanceCommitmentType, string> = {
  loan: "Loan",
  insurance: "Insurance",
  sip: "Investment",
  bill: "Bill",
};

export async function saveEmi(id: string | null, form: EmiForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const noun = TYPE_NOUN[form.type] ?? "Entry";
  if (!form.name.trim()) return { ok: false, error: `${noun} name is required.` };
  if (!(form.emiAmount > 0))
    return {
      ok: false,
      error:
        form.type === "sip"
          ? "Enter the monthly investment amount."
          : "Enter the monthly amount.",
    };
  if (!form.startDate) return { ok: false, error: "Pick a start date." };
  const dueDay = Math.min(31, Math.max(1, Math.round(form.dueDay || 1)));
  // Only loans have a finite payoff; insurance, bills and SIPs are open-ended.
  const total = form.type === "loan" ? Math.max(0, Math.round(form.totalInstallments || 0)) : 0;
  const categoryId = await resolveCategoryId(sb, form.scope, form.type, form.categoryId);

  const base = {
    scope: form.scope,
    type: form.type,
    name: form.name.trim(),
    lender: form.lender.trim(),
    category_id: categoryId,
    principal: round2(form.principal || 0),
    current_value: form.type === "sip" ? round2(form.currentValue || 0) : 0,
    scheme_code: form.type === "sip" ? (form.schemeCode?.trim() || null) : null,
    units: form.type === "sip" ? Math.max(0, form.units || 0) : 0,
    emi_amount: round2(form.emiAmount),
    interest_rate: form.interestRate || 0,
    total_installments: total,
    paid_installments: Math.max(0, Math.round(form.paidInstallments || 0)),
    start_date: form.startDate,
    due_day: dueDay,
    status: form.status,
    notes: form.notes.trim(),
  };
  const next_due_date = computeNextDue(base);
  const payload = { ...base, next_due_date, updated_at: new Date().toISOString() };

  if (id) {
    const { error } = await sb.from("finance_emis").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id, message: `${noun} updated` };
  }
  const { data, error } = await sb
    .from("finance_emis")
    .insert({ ...payload, created_by: me.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || `Failed to save ${noun.toLowerCase()}.` };
  refresh();
  return { ok: true, id: data.id, message: `${noun} added` };
}

export async function deleteEmi(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { error } = await sb.from("finance_emis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Loan deleted" };
}

// Record one installment/contribution as paid, advance the schedule by a month.
//  * loan / insurance → posts an expense line (money spent), so the P&L reflects it.
//  * sip (investment)  → does NOT post an expense; it just adds a contribution
//    (invested = contributions × amount), because it builds an asset, not a cost.
export async function payEmiInstallment(
  id: string,
  paidOn?: string,
  method: FinancePaymentMethod = "auto_debit",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { data: emi } = await sb.from("finance_emis").select("*").eq("id", id).maybeSingle();
  if (!emi) return { ok: false, error: "Not found." };
  const e = emi as FinanceEmiRow;
  if (e.total_installments > 0 && e.paid_installments >= e.total_installments)
    return { ok: false, error: "This is already fully paid." };

  const when = paidOn || e.next_due_date || new Date().toISOString().slice(0, 10);
  const paid = e.paid_installments + 1;
  const closed = e.total_installments > 0 && paid >= e.total_installments;
  const next_due_date = closed ? null : advanceAfterPayment(e.next_due_date, e.due_day);
  const isInvestment = e.type === "sip";

  // Loans & insurance premiums are money spent → mirror an expense line so the
  // ledger and P&L pick it up. SIPs are investments → no expense line.
  if (!isInvestment) {
    const prefix = e.type === "insurance" ? "Premium" : e.type === "bill" ? "Bill" : "EMI";
    const { error: expErr } = await sb.from("finance_expenses").insert({
      scope: e.scope,
      category_id: e.category_id,
      is_income: false,
      title: `${prefix} — ${e.name}${e.total_installments > 0 ? ` (${paid}/${e.total_installments})` : ""}`,
      amount: round2(e.emi_amount),
      txn_date: when,
      payment_method: method,
      payee: e.lender,
      notes: "Auto-logged from the commitments tracker",
      emi_id: e.id,
      created_by: me.id,
    });
    if (expErr) return { ok: false, error: expErr.message };
  }

  const { error } = await sb
    .from("finance_emis")
    .update({
      paid_installments: paid,
      status: closed ? "closed" : e.status,
      next_due_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  const label =
    e.type === "sip"
      ? "Contribution recorded"
      : closed
        ? "Final payment made — closed"
        : e.type === "insurance"
          ? "Premium paid"
          : e.type === "bill"
            ? "Bill paid"
            : "Installment paid";
  return { ok: true, message: label };
}

// Undo the last SIP contribution (e.g. clicked by mistake). SIP contributions
// post no expense, so they can't be reversed from the ledger — this rolls the
// count back one and moves the next-due back a month. (Loan/insurance/bill
// payments are reversed instead by deleting their transaction in the ledger.)
export async function reverseContribution(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { data: emi } = await sb.from("finance_emis").select("*").eq("id", id).maybeSingle();
  if (!emi) return { ok: false, error: "Not found." };
  const e = emi as FinanceEmiRow;
  if (e.type !== "sip")
    return { ok: false, error: "Undo a loan/premium/bill payment by deleting its transaction in the ledger." };
  if (e.paid_installments <= 0) return { ok: false, error: "No contribution to undo." };

  const base = e.next_due_date ? new Date(e.next_due_date + "T00:00:00") : new Date();
  const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
  const lastDay = new Date(prev.getFullYear(), prev.getMonth() + 1, 0).getDate();
  const day = Math.min(e.due_day, lastDay);
  const prevDue = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const { error } = await sb
    .from("finance_emis")
    .update({
      paid_installments: e.paid_installments - 1,
      status: e.status === "closed" ? "active" : e.status,
      next_due_date: prevDue,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Contribution reversed" };
}

// Catch-up: for every active recurring EXPENSE commitment (loan / insurance /
// bill), post any missing monthly payment from the start of the current
// financial year up to this month — idempotent, so re-running only adds what's
// missing. This is the one-click "auto-fill each month" the EMI backfill SQL did.
export async function postDuePayments(): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };

  const { data: rows } = await sb.from("finance_emis").select("*").eq("status", "active");
  const commitments = ((rows ?? []) as FinanceEmiRow[]).filter((e) =>
    ["loan", "insurance", "bill", "sip"].includes(e.type),
  );
  if (commitments.length === 0) return { ok: true, message: "No active recurring payments to post." };

  // financial year start (1 Apr) and the end of the current month
  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fyStart = `${fyStartYear}-04-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthEndISO = monthEnd.toISOString().slice(0, 10);
  const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthFirstISO = `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, "0")}-01`;

  let posted = 0;
  for (const e of commitments) {
    // SIPs are investments — recording a contribution advances the schedule but
    // does NOT post an expense. Catch up any due months up to now.
    if (e.type === "sip") {
      if (!e.next_due_date || e.next_due_date > monthEndISO) continue;
      const nd = new Date(e.next_due_date + "T00:00:00");
      const months = (now.getFullYear() - nd.getFullYear()) * 12 + (now.getMonth() - nd.getMonth()) + 1;
      if (months <= 0) continue;
      await sb
        .from("finance_emis")
        .update({
          paid_installments: e.paid_installments + months,
          next_due_date: nextDueOnOrAfter(nextMonthFirstISO, e.due_day),
          updated_at: new Date().toISOString(),
        })
        .eq("id", e.id);
      posted += months;
      continue;
    }

    const dates = duePaymentDates({ start_date: e.start_date, due_day: e.due_day }, fyStart, monthEndISO);
    if (dates.length === 0) continue;

    // which months already have a posted line for this commitment?
    const { data: existing } = await sb
      .from("finance_expenses")
      .select("txn_date")
      .eq("emi_id", e.id);
    const haveMonths = new Set((existing ?? []).map((x) => (x.txn_date || "").slice(0, 7)));

    const toInsert = dates.filter((d) => !haveMonths.has(d.slice(0, 7)));
    if (toInsert.length === 0) continue;

    const prefix = e.type === "insurance" ? "Premium" : e.type === "bill" ? "Bill" : "EMI";
    const rowsToInsert = toInsert.map((d) => ({
      scope: e.scope,
      category_id: e.category_id,
      is_income: false,
      title: `${prefix} — ${e.name}`,
      amount: round2(e.emi_amount),
      txn_date: d,
      payment_method: "auto_debit" as FinancePaymentMethod,
      payee: e.lender,
      notes: "Auto-posted recurring payment",
      emi_id: e.id,
      created_by: me.id,
    }));
    const { error } = await sb.from("finance_expenses").insert(rowsToInsert);
    if (error) return { ok: false, error: error.message };
    posted += rowsToInsert.length;

    // Advance the schedule so a just-posted month no longer shows as due. We've
    // caught up through this month, so the next due is next month.
    const isLoan = e.type === "loan" && e.total_installments > 0;
    const paid = isLoan
      ? Math.min(e.total_installments, e.paid_installments + rowsToInsert.length)
      : e.paid_installments + rowsToInsert.length;
    const closed = isLoan && paid >= e.total_installments;
    await sb
      .from("finance_emis")
      .update({
        paid_installments: paid,
        status: closed ? "closed" : e.status,
        next_due_date: closed ? null : nextDueOnOrAfter(nextMonthFirstISO, e.due_day),
        updated_at: new Date().toISOString(),
      })
      .eq("id", e.id);
  }

  refresh();
  return {
    ok: true,
    message: posted === 0 ? "Everything's already up to date." : `Posted ${posted} payment${posted === 1 ? "" : "s"}.`,
  };
}
