// Server component: a transaction table with inline edit/delete actions.
import { format } from "date-fns";
import { money } from "@/lib/invoice";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance";
import { ExpenseRowActions } from "@/components/finance/expense-row-actions";
import type { FinanceCategoryRow, FinanceExpenseRow } from "@/lib/database.types";

export function ExpenseLedger({
  expenses,
  categories,
}: {
  expenses: FinanceExpenseRow[];
  categories: FinanceCategoryRow[];
}) {
  if (expenses.length === 0)
    return (
      <div className="py-10 text-center text-[13px] text-[#8a94a6]">
        No entries yet for this period.
      </div>
    );

  const catById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b border-[#e9edf3] text-left text-[11px] font-bold uppercase tracking-wide text-[#9aa4b6]">
            <th className="py-2 pr-3 font-bold">Date</th>
            <th className="py-2 pr-3 font-bold">Description</th>
            <th className="py-2 pr-3 font-bold">Category</th>
            <th className="py-2 pr-3 font-bold">Method</th>
            <th className="py-2 pr-3 text-right font-bold">Amount</th>
            <th className="py-2 pl-3 text-right font-bold"></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((r) => {
            const cat = r.category_id ? catById.get(r.category_id) : undefined;
            return (
              <tr key={r.id} className="border-b border-[#f1f4f9] hover:bg-[#fafbfd]">
                <td className="py-2.5 pr-3 text-[12.5px] font-semibold whitespace-nowrap text-[#42506b] tabular-nums">
                  {format(new Date(r.txn_date + "T00:00:00"), "d MMM yy")}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="text-[13px] font-bold">{r.title}</div>
                  {r.payee && (
                    <div className="text-[11.5px] font-medium text-[#8a94a6]">{r.payee}</div>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  {cat ? (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} />
                      {cat.name}
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-[#9aa4b6]">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-[12.5px] font-medium text-[#8a94a6]">
                  {PAYMENT_METHOD_LABEL[r.payment_method]}
                </td>
                <td
                  className="py-2.5 pr-3 text-right text-[13px] font-extrabold tabular-nums"
                  style={{ color: r.is_income ? "#16a34a" : "#0e1320" }}
                >
                  {r.is_income ? "+" : "−"}
                  {money(r.amount)}
                </td>
                <td className="py-2.5 pl-3">
                  <ExpenseRowActions expense={r} categories={categories} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
