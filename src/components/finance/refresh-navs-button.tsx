"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshNavs } from "@/lib/actions/finance";

export function RefreshNavsButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          const res = await refreshNavs();
          if (res.ok) {
            toast.success(res.message ?? "Refreshed");
            router.refresh();
          } else toast.error(res.error ?? "Something went wrong");
        })
      }
      disabled={pending}
      className="flex items-center gap-1.5 rounded-[9px] border border-[#e3e8f0] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#42506b] hover:border-[#16a34a] hover:text-[#16a34a] disabled:opacity-50"
      title="Pull the latest declared NAVs"
    >
      <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
      {pending ? "Refreshing…" : "Refresh NAVs"}
    </button>
  );
}
