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
import type {
  ProfileRow,
  ClientRow,
  UserRole,
  CandidateRow,
  JobRow,
} from "@/lib/database.types";
import { CandidateDrawer } from "@/components/candidate-drawer";
import { CandidateFormModal } from "@/components/candidate-form-modal";
import { JobFormModal } from "@/components/create-req-modal";
import { ScheduleModal } from "@/components/schedule-modal";

type ShellCtx = {
  role: UserRole;
  canWrite: boolean;
  team: ProfileRow[];
  clients: ClientRow[];
  openDrawer: (id: string) => void;
  openCreateReq: () => void;
  openJobForm: (job?: JobRow | null) => void;
  openCandidateForm: (candidate?: CandidateRow | null) => void;
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
  const [candForm, setCandForm] = useState<{
    open: boolean;
    candidate: CandidateRow | null;
  }>({ open: false, candidate: null });
  const [jobForm, setJobForm] = useState<{ open: boolean; job: JobRow | null }>({
    open: false,
    job: null,
  });
  const [sched, setSched] = useState<{ open: boolean; candidateId?: string }>({
    open: false,
  });

  const canWrite = role !== "client";

  const openDrawer = useCallback((id: string) => setDrawerId(id), []);
  const openCandidateForm = useCallback(
    (candidate?: CandidateRow | null) =>
      setCandForm({ open: true, candidate: candidate ?? null }),
    [],
  );
  const openJobForm = useCallback(
    (job?: JobRow | null) => setJobForm({ open: true, job: job ?? null }),
    [],
  );
  const openCreateReq = useCallback(() => openJobForm(null), [openJobForm]);
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
        openJobForm,
        openCandidateForm,
        openSchedule,
      }}
    >
      {children}
      <CandidateDrawer
        candidateId={drawerId}
        canWrite={canWrite}
        onClose={() => setDrawerId(null)}
        onEdit={(c) => {
          setDrawerId(null);
          openCandidateForm(c);
        }}
        onSchedule={(id) => {
          setDrawerId(null);
          openSchedule(id);
        }}
      />
      <CandidateFormModal
        open={candForm.open}
        candidate={candForm.candidate}
        team={team}
        onClose={() => setCandForm({ open: false, candidate: null })}
      />
      <JobFormModal
        open={jobForm.open}
        job={jobForm.job}
        team={team}
        clients={clients}
        onClose={() => setJobForm({ open: false, job: null })}
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
