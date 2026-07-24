"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/invoice";
import { computeNextDue } from "@/lib/finance";
import type {
  FinanceScope,
  FinanceCategoryKind,
  FinancePaymentMethod,
  FinanceEmiStatus,
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
  name: string;
  lender: string;
  categoryId: string | null;
  principal: number;
  emiAmount: number;
  interestRate: number;
  totalInstallments: number;
  paidInstallments: number;
  startDate: string;
  dueDay: number;
  status: FinanceEmiStatus;
  notes: string;
};

export async function saveEmi(id: string | null, form: EmiForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  if (!form.name.trim()) return { ok: false, error: "Loan / EMI name is required." };
  if (!(form.emiAmount > 0)) return { ok: false, error: "Enter the monthly installment amount." };
  if (!form.startDate) return { ok: false, error: "Pick a start date." };
  const dueDay = Math.min(31, Math.max(1, Math.round(form.dueDay || 1)));

  const base = {
    scope: form.scope,
    name: form.name.trim(),
    lender: form.lender.trim(),
    category_id: form.categoryId,
    principal: round2(form.principal || 0),
    emi_amount: round2(form.emiAmount),
    interest_rate: form.interestRate || 0,
    total_installments: Math.max(0, Math.round(form.totalInstallments || 0)),
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
    return { ok: true, id, message: "Loan updated" };
  }
  const { data, error } = await sb
    .from("finance_emis")
    .insert({ ...payload, created_by: me.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Failed to save loan." };
  refresh();
  return { ok: true, id: data.id, message: "Loan added" };
}

export async function deleteEmi(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { error } = await sb.from("finance_emis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Loan deleted" };
}

// Mark this month's installment paid: advances the schedule and drops a mirror
// expense line into the ledger so the P&L reflects it.
export async function payEmiInstallment(
  id: string,
  paidOn?: string,
  method: FinancePaymentMethod = "auto_debit",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage Finance." };
  const { data: emi } = await sb.from("finance_emis").select("*").eq("id", id).maybeSingle();
  if (!emi) return { ok: false, error: "Loan not found." };
  const e = emi as FinanceEmiRow;
  if (e.total_installments > 0 && e.paid_installments >= e.total_installments)
    return { ok: false, error: "This loan is already fully paid." };

  const when = paidOn || e.next_due_date || new Date().toISOString().slice(0, 10);
  const paid = e.paid_installments + 1;
  const closed = e.total_installments > 0 && paid >= e.total_installments;
  const nextEmi = {
    ...e,
    paid_installments: paid,
    status: closed ? ("closed" as FinanceEmiStatus) : e.status,
  };
  const next_due_date = computeNextDue(nextEmi);

  // mirror expense line
  const { error: expErr } = await sb.from("finance_expenses").insert({
    scope: e.scope,
    category_id: e.category_id,
    is_income: false,
    title: `EMI — ${e.name}${e.total_installments > 0 ? ` (${paid}/${e.total_installments})` : ""}`,
    amount: round2(e.emi_amount),
    txn_date: when,
    payment_method: method,
    payee: e.lender,
    notes: "Auto-logged from EMI tracker",
    emi_id: e.id,
    created_by: me.id,
  });
  if (expErr) return { ok: false, error: expErr.message };

  const { error } = await sb
    .from("finance_emis")
    .update({
      paid_installments: paid,
      status: nextEmi.status,
      next_due_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: closed ? "Final installment paid — loan closed" : "Installment paid" };
}
