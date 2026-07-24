"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ExpenseModal } from "@/components/finance/expense-modal";
import { deleteExpense } from "@/lib/actions/finance";
import type { FinanceCategoryRow, FinanceExpenseRow } from "@/lib/database.types";

export function ExpenseRowActions({
  expense,
  categories,
}: {
  expense: FinanceExpenseRow;
  categories: FinanceCategoryRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const remove = () =>
    start(async () => {
      const res = await deleteExpense(expense.id);
      if (res.ok) {
        toast.success(res.message ?? "Deleted");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not delete");
      }
    });

  return (
    <div className="flex items-center justify-end gap-1">
      {!expense.emi_id && (
        <ExpenseModal
          scope={expense.scope}
          categories={categories}
          expense={expense}
          trigger={
            <button
              className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#f1f4f9] hover:text-[#2a6fdb]"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
          }
        />
      )}
      <button
        onClick={remove}
        disabled={pending}
        className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
        title={expense.emi_id ? "Delete (also reverses the EMI installment)" : "Delete"}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
