"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useShell } from "@/components/shell-provider";
import {
  acceptOffer,
  advanceTalent,
  updateSetting,
} from "@/lib/actions/mutations";

export function OpenOnClick({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { openDrawer } = useShell();
  return (
    <div onClick={() => openDrawer(id)} className={className}>
      {children}
    </div>
  );
}

export function ClickableTr({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { openDrawer } = useShell();
  return (
    <tr onClick={() => openDrawer(id)} className={className}>
      {children}
    </tr>
  );
}

export function ScheduleButton({
  candidateId,
  className,
  children,
}: {
  candidateId?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openSchedule, canWrite } = useShell();
  if (!canWrite) return null;
  return (
    <button onClick={() => openSchedule(candidateId)} className={className}>
      {children}
    </button>
  );
}

export function NewInterviewButton() {
  const { openSchedule, canWrite } = useShell();
  if (!canWrite) return null;
  return (
    <button
      onClick={() => openSchedule()}
      className="flex items-center gap-[7px] rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_3px_10px_rgba(42,111,219,.3)] hover:bg-[#1f5bc0]"
    >
      <Plus size={16} strokeWidth={2.4} />
      Schedule Interview
    </button>
  );
}

export function OfferActions({
  id,
  accepted,
}: {
  id: string;
  accepted: boolean;
}) {
  const router = useRouter();
  const { openDrawer, canWrite } = useShell();
  const [pending, start] = useTransition();
  return (
    <div className="mt-3.5 flex gap-2">
      {canWrite && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await acceptOffer(id);
              if (res.ok) {
                toast.success(res.message ?? "Updated");
                router.refresh();
              } else toast.error(res.error ?? "Failed");
            })
          }
          className="flex-1 rounded-[9px] py-2.5 text-[12.5px] font-bold text-white disabled:opacity-60"
          style={{ background: accepted ? "#16a34a" : "#2a6fdb" }}
        >
          {accepted ? "Mark Joined" : "Mark Accepted"}
        </button>
      )}
      <button
        onClick={() => openDrawer(id)}
        className="flex-1 rounded-[9px] border border-[#e6eaf1] bg-[#f6f8fb] py-2.5 text-[12.5px] font-bold text-[#42506b] hover:bg-[#eef1f6]"
      >
        View Profile
      </button>
    </div>
  );
}

export function TalentAdvance({ id }: { id: string }) {
  const router = useRouter();
  const { canWrite } = useShell();
  const [pending, start] = useTransition();
  if (!canWrite) return null;
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await advanceTalent(id);
          if (res.ok) {
            toast.success(res.message ?? "Moved");
            router.refresh();
          } else toast.error(res.error ?? "Failed");
        })
      }
      className="mt-3.5 w-full rounded-[9px] bg-[#eef4fe] py-2.5 text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd] disabled:opacity-60"
    >
      Move to Screening →
    </button>
  );
}

export function SettingsToggle({
  settingKey,
  initial,
  disabled,
}: {
  settingKey: "email_notif" | "auto_reject" | "client_portal" | "two_factor";
  initial: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <button
      disabled={disabled || pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const res = await updateSetting(settingKey, next);
          if (res.ok) router.refresh();
          else {
            setOn(!next);
            toast.error(res.error ?? "Failed");
          }
        });
      }}
      className="flex h-6 w-[42px] rounded-full p-0.5 transition disabled:opacity-50"
      style={{
        background: on ? "#2a6fdb" : "#cbd3e0",
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)]" />
    </button>
  );
}
