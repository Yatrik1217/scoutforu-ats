"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { setJobCritical, assignJobRecruiter } from "@/lib/actions/mutations";

// Pin/unpin a role as Critical (forces it to the top of Weekly Focus).
export function CriticalToggle({ jobId, critical }: { jobId: string; critical: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      title={critical ? "Remove Critical" : "Mark as Critical (pin to top)"}
      onClick={() =>
        start(async () => {
          const r = await setJobCritical(jobId, !critical);
          if (r.ok) {
            toast.success(r.message ?? "Done");
            router.refresh();
          } else toast.error(r.error ?? "Failed");
        })
      }
      className={
        critical
          ? "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] bg-[#dc2626] text-white disabled:opacity-50"
          : "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border border-[#eef1f6] text-[#c3ccdb] hover:border-[#f3c4c4] hover:text-[#dc2626] disabled:opacity-50"
      }
    >
      <Flag size={13} strokeWidth={2.4} fill={critical ? "currentColor" : "none"} />
    </button>
  );
}

// Assign / reassign the lead recruiter directly from the row.
export function AssignRecruiterSelect({
  jobId,
  current,
  recruiters,
}: {
  jobId: string;
  current: string | null;
  recruiters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      value={current ?? ""}
      disabled={pending}
      onChange={(e) => {
        const rid = e.target.value || null;
        start(async () => {
          const r = await assignJobRecruiter(jobId, rid);
          if (r.ok) {
            toast.success(r.message ?? "Assigned");
            router.refresh();
          } else toast.error(r.error ?? "Failed");
        });
      }}
      className={`w-[132px] cursor-pointer rounded-[8px] border bg-white px-2 py-1 text-[11.5px] font-bold outline-none disabled:opacity-50 ${
        current ? "border-[#e3e8f0] text-[#42506b]" : "border-[#f3c4c4] text-[#dc2626]"
      }`}
      title="Assign a recruiter to this role"
    >
      <option value="">Unassigned</option>
      {recruiters.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
