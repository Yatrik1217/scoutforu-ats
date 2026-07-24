"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { InvestmentModal } from "@/components/finance/investment-modal";
import { payEmiInstallment, deleteEmi } from "@/lib/actions/finance";
import type { FinanceEmiRow } from "@/lib/database.types";

export function InvestmentActions({ emi }: { emi: FinanceEmiRow }) {
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

  return (
    <div className="flex items-center gap-1.5">
      {emi.status === "active" && (
        <button
          onClick={() => run(() => payEmiInstallment(emi.id))}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-[8px] bg-[#eafaf0] px-2.5 py-1.5 text-[12px] font-bold text-[#128a3e] hover:bg-[#d7f5e3] disabled:opacity-50"
          title="Record this month's contribution"
        >
          <Plus size={14} />
          Contribution
        </button>
      )}
      <InvestmentModal
        scope={emi.scope}
        emi={emi}
        trigger={
          <button className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#f1f4f9] hover:text-[#2a6fdb]" title="Edit / update value">
            <Pencil size={15} />
          </button>
        }
      />
      <button
        onClick={() => run(() => deleteEmi(emi.id))}
        disabled={pending}
        className="rounded-[7px] p-1.5 text-[#8a94a6] hover:bg-[#fef2f2] hover:text-[#dc2626] disabled:opacity-40"
        title="Delete investment"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
