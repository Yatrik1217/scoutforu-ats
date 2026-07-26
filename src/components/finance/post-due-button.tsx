"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { postDuePayments } from "@/lib/actions/finance";

// One-click catch-up: posts every missing monthly payment for active loans,
// insurance premiums and recurring bills, from the FY start to this month.
export function PostDueButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await postDuePayments();
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
    });

  return (
    <button
      onClick={run}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-50"
      title="Post any missing monthly payments up to this month"
    >
      <CalendarCheck size={15} />
      {pending ? "Posting…" : "Post due payments"}
    </button>
  );
}
