"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRow, ClientRow, UserRole } from "@/lib/database.types";
import { CandidateDrawer } from "@/components/candidate-drawer";
import { CreateReqModal } from "@/components/create-req-modal";
import { ScheduleModal } from "@/components/schedule-modal";

type ShellCtx = {
  role: UserRole;
  canWrite: boolean;
  team: ProfileRow[];
  clients: ClientRow[];
  openDrawer: (id: string) => void;
  openCreateReq: () => void;
  openSchedule: (candidateId?: string) => void;
};

const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useShell outside provider");
  return c;
};

export function ShellProvider({
  role,
  team,
  clients,
  children,
}: {
  role: UserRole;
  team: ProfileRow[];
  clients: ClientRow[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [createReq, setCreateReq] = useState(false);
  const [sched, setSched] = useState<{ open: boolean; candidateId?: string }>({
    open: false,
  });

  const canWrite = role !== "client";

  const openDrawer = useCallback((id: string) => setDrawerId(id), []);
  const openCreateReq = useCallback(() => setCreateReq(true), []);
  const openSchedule = useCallback(
    (candidateId?: string) => setSched({ open: true, candidateId }),
    [],
  );

  // Realtime — refresh server components when anyone changes shared data.
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const sb = createClient();
    const channel = sb
      .channel("ats-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [router]);

  return (
    <Ctx.Provider
      value={{
        role,
        canWrite,
        team,
        clients,
        openDrawer,
        openCreateReq,
        openSchedule,
      }}
    >
      {children}
      <CandidateDrawer
        candidateId={drawerId}
        canWrite={canWrite}
        onClose={() => setDrawerId(null)}
        onSchedule={(id) => {
          setDrawerId(null);
          openSchedule(id);
        }}
      />
      <CreateReqModal
        open={createReq}
        team={team}
        clients={clients}
        onClose={() => setCreateReq(false)}
      />
      <ScheduleModal
        open={sched.open}
        candidateId={sched.candidateId}
        team={team}
        onClose={() => setSched({ open: false })}
      />
    </Ctx.Provider>
  );
}
