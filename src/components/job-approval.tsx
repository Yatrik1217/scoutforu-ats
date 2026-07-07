"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { setJobApproval } from "@/lib/actions/mutations";

export function JobApprovalActions({ jobId }: { jobId: string }) {
  const [pending, start] = useTransition();
  const act = (status: "approved" | "rejected") =>
    start(async () => {
      const res = await setJobApproval(jobId, status);
      if (res.ok) toast.success(res.message || "Done");
      else toast.error(res.error || "Failed");
    });

  return (
    <div className="mt-3 flex gap-2 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-2.5">
      <span className="flex-1 self-center text-[12px] font-bold text-[#b45309]">
        Awaiting approval
      </span>
      <button
        onClick={() => act("rejected")}
        disabled={pending}
        className="flex items-center gap-1 rounded-[8px] border border-[#fca5a5] bg-white px-3 py-1.5 text-[12px] font-bold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
      >
        <X size={13} /> Reject
      </button>
      <button
        onClick={() => act("approved")}
        disabled={pending}
        className="flex items-center gap-1 rounded-[8px] bg-[#16a34a] px-3 py-1.5 text-[12px] font-bold text-white hover:bg-[#15803d] disabled:opacity-50"
      >
        <Check size={13} /> Approve
      </button>
    </div>
  );
}
