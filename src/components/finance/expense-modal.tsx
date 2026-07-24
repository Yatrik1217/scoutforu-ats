"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { saveExpense, type ExpenseForm } from "@/lib/actions/finance";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import type {
  FinanceCategoryRow,
  FinanceExpenseRow,
  FinanceScope,
  FinancePaymentMethod,
} from "@/lib/database.types";

const field =
  "w-full rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#16a34a]";
const label = "block text-[12px] font-bold text-[#42506b] mb-1";

const METHODS: FinancePaymentMethod[] = [
  "bank_transfer",
  "upi",
  "cash",
  "card",
  "auto_debit",
  "cheque",
  "other",
];

export function ExpenseModal({
  scope,
  categories,
  expense,
  trigger,
}: {
  scope: FinanceScope;
  categories: FinanceCategoryRow[];
  expense?: FinanceExpenseRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  const [f, setF] = useState<ExpenseForm>(() => ({
    scope,
    categoryId: expense?.category_id ?? null,
    isIncome: expense?.is_income ?? false,
    title: expense?.title ?? "",
    amount: expense?.amount ?? 0,
    txnDate: expense?.txn_date ?? today,
    paymentMethod: expense?.payment_method ?? "bank_transfer",
    payee: expense?.payee ?? "",
    notes: expense?.notes ?? "",
  }));

  const set = <K extends keyof ExpenseForm>(k: K, v: ExpenseForm[K]) =>
    setF((p) => ({ ...p, [k]: v }));

  const kind = f.isIncome ? "income" : "expense";
  const cats = categories.filter((c) => c.kind === kind && !c.archived);

  const submit = () =>
    start(async () => {
      const res = await saveExpense(expense?.id ?? null, f);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        setOpen(false);
        if (!expense) {
          setF((p) => ({ ...p, title: "", amount: 0, payee: "", notes: "" }));
        }
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-extrabold">
              {expense ? "Edit entry" : f.isIncome ? "Add income" : "Add expense"}
              <span className="ml-2 rounded-full bg-[#eef4fe] px-2 py-0.5 text-[11px] font-bold text-[#2a6fdb] capitalize">
                {scope}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            {/* income / expense toggle */}
            <div className="flex gap-1.5 rounded-[9px] bg-[#f1f4f9] p-1">
              <button
                type="button"
                onClick={() => set("isIncome", false)}
                className={`flex-1 rounded-[7px] py-1.5 text-[12.5px] font-bold transition ${!f.isIncome ? "bg-white text-[#dc2626] shadow-sm" : "text-[#8a94a6]"}`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => set("isIncome", true)}
                className={`flex-1 rounded-[7px] py-1.5 text-[12.5px] font-bold transition ${f.isIncome ? "bg-white text-[#16a34a] shadow-sm" : "text-[#8a94a6]"}`}
              >
                Income
              </button>
            </div>

            <div>
              <label className={label}>Description</label>
              <input
                className={field}
                value={f.title}
                autoFocus
                onChange={(e) => set("title", e.target.value)}
                placeholder={f.isIncome ? "e.g. Consulting income" : "e.g. Petrol — HP pump"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Amount (₹)</label>
                <NumberInput
                  className={field}
                  value={f.amount}
                  onChange={(n) => set("amount", n)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={label}>Date</label>
                <input
                  type="date"
                  className={field}
                  value={f.txnDate}
                  onChange={(e) => set("txnDate", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Category</label>
                <select
                  className={field}
                  value={f.categoryId ?? ""}
                  onChange={(e) => set("categoryId", e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.ebitda_addback ? " (below EBITDA)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Paid via</label>
                <select
                  className={field}
                  value={f.paymentMethod}
                  onChange={(e) => set("paymentMethod", e.target.value as FinancePaymentMethod)}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={label}>{f.isIncome ? "Source" : "Payee / Vendor"} (optional)</label>
              <input
                className={field}
                value={f.payee}
                onChange={(e) => set("payee", e.target.value)}
                placeholder={f.isIncome ? "Who paid you" : "Who you paid"}
              />
            </div>

            <div>
              <label className={label}>Notes (optional)</label>
              <input
                className={field}
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="rounded-[9px] px-3.5 py-2 text-[13px] font-bold text-[#42506b] hover:bg-[#f1f4f9]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={pending}
              className="rounded-[9px] bg-[#16a34a] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#128a3e] disabled:opacity-50"
            >
              {pending ? "Saving…" : expense ? "Save changes" : "Add entry"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
