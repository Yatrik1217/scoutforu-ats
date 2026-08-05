"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reassignRecruiterWork, setUserActive } from "@/lib/actions/mutations";

type Member = { id: string; name: string; role: string; active: boolean };

export function DeactivateRecruiter({
  id,
  name,
  active,
  team,
}: {
  id: string;
  name: string;
  active: boolean;
  team: Member[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toId, setToId] = useState("");
  const [pending, start] = useTransition();

  // People who can receive her work: active recruiters + the admin, not herself.
  const receivers = team.filter(
    (m) => m.id !== id && m.active !== false && m.role !== "client",
  );

  // Reactivating is a simple one-click toggle.
  if (!active) {
    return (
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setUserActive(id, true);
            if (res.ok) {
              toast.success(res.message ?? "Activated");
              router.refresh();
            } else toast.error(res.error ?? "Failed");
          })
        }
        className="rounded-lg border border-[#bfe6cd] bg-[#e9f9ef] px-2.5 py-1 text-[11px] font-bold text-[#16a34a] transition disabled:opacity-50"
      >
        Activate
      </button>
    );
  }

  const run = (deactivate: boolean) =>
    start(async () => {
      // Reassign only if a receiver was chosen; otherwise just deactivate.
      if (toId) {
        const res = await reassignRecruiterWork({ fromId: id, toId, deactivate });
        if (res.ok) {
          toast.success(res.message ?? "Done");
          setOpen(false);
          router.refresh();
        } else toast.error(res.error ?? "Failed");
        return;
      }
      const res = await setUserActive(id, false);
      if (res.ok) {
        toast.success(res.message ?? "Deactivated");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error ?? "Failed");
    });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[#f3c4c4] bg-[#fef2f2] px-2.5 py-1 text-[11px] font-bold text-[#dc2626] transition"
      >
        Deactivate
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-extrabold text-[#16203a]">
              Deactivate {name}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6b7686]">
              She won&apos;t be able to sign in, but all her data stays in the system.
              Optionally hand her <b>open candidates &amp; jobs</b> to someone else so
              follow-ups don&apos;t stall. Her past hires and placements stay credited to her.
            </p>

            <label className="mt-4 block text-[12px] font-bold text-[#42506b]">
              Reassign open work to
            </label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] px-3 py-2.5 text-[14px] font-medium text-[#16203a] outline-none focus:border-[#2a6fdb] focus:bg-white"
            >
              <option value="">— Don&apos;t reassign (leave with {name}) —</option>
              {receivers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role === "master_admin" ? " (Admin)" : ""}
                </option>
              ))}
            </select>

            <div className="mt-6 flex justify-end gap-2">
              <button
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                onClick={() => run(true)}
                className="rounded-[10px] bg-[#dc2626] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#c11f1f] disabled:opacity-60"
              >
                {pending
                  ? "Working…"
                  : toId
                    ? "Reassign & deactivate"
                    : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
