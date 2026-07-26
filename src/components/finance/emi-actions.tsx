"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { EmiModal } from "@/components/finance/emi-modal";
import { payEmiInstallment, deleteEmi } from "@/lib/actions/finance";
import type { FinanceCategoryRow, FinanceEmiRow } from "@/lib/database.types";

export function EmiActions({
  emi,
  categories,
}: {
  emi: FinanceEmiRow;
  categories: FinanceCategoryRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  const fullyPaid = emi.total_installments > 0 && emi.paid_installments >= emi.total_installments;

  return (
    <div className="flex items-center gap-1.5">
      {emi.status === "active" && !fullyPaid && (
        <button
          onClick={() => run(() => payEmiInstallment(emi.id))}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-[8px] bg-[#eafaf0] px-2.5 py-1.5 text-[12px] font-bold text-[#128a3e] hover:bg-[#d7f5e3] disabled:opacity-50"
          title="Record this month's payment"
        >
          <CheckCircle2 size={14} />
          {emi.type === "insurance" ? "Pay premium" : emi.type === "bill" ? "Pay bill" : "Pay EMI"}
        </button>
      )}
      <EmiModal
        scope={emi.scope}
        categories={categories}
        emi={emi}
        trigger={
          <button className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#f1f4f9] hover:text-[#2a6fdb]" title="Edit">
            <Pencil size={15} />
          </button>
        }
      />
      <button
        onClick={() => run(() => deleteEmi(emi.id))}
        disabled={pending}
        className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
        title="Delete loan"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
