"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { payEmiInstallment } from "@/lib/actions/finance";

// "Mark paid" for a single due line on the Upcoming / Scheduled lists. Records
// just THIS commitment's payment (posts its expense + advances the schedule) —
// unlike "Post due", which catches up every recurring payment at once. Only
// shown for lines backed by a commitment (DueItem.emiId set).
export function PayDueButton({
  emiId,
  paidOn,
  label = "Mark paid",
}: {
  emiId: string;
  paidOn?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() =>
        start(async () => {
          const res = await payEmiInstallment(emiId, paidOn);
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
