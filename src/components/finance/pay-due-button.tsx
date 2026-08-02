"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { payEmiInstallment, markExpensePaid } from "@/lib/actions/finance";

// "Mark paid" for a single due line on the Upcoming / Scheduled lists. Records
// just THIS payment — unlike "Post due", which catches up everything at once.
//  * commitment line (emiId)   → records the installment + advances the schedule
//  * one-off bill line (expenseId) → ticks the expense as paid (drops it off Upcoming)
export function PayDueButton({
  emiId,
  expenseId,
  paidOn,
  label = "Mark paid",
}: {
  emiId?: string;
  expenseId?: string;
  paidOn?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          const res = emiId
            ? await payEmiInstallment(emiId, paidOn)
            : expenseId
              ? await markExpensePaid(expenseId, paidOn)
              : { ok: false as const, error: "Nothing to mark paid." };
          if (res.ok) {
            toast.success(res.message ?? "Marked paid");
            router.refresh();
          } else {
            toast.error(res.error ?? "Couldn't mark paid");
          }
        })
      }
      disabled={pending}
      className="flex shrink-0 items-center gap-1.5 rounded-[8px] bg-[#eafaf0] px-2.5 py-1.5 text-[12px] font-bold text-[#128a3e] hover:bg-[#d7f5e3] disabled:opacity-50"
      title="Record this payment as paid"
    >
      <CheckCircle2 size={14} />
      {pending ? "Saving…" : label}
    </button>
  );
}
