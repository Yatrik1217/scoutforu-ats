"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Bell, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShell } from "@/components/shell-provider";
import { signOutAction } from "@/lib/actions/auth";
import { setPreviewAction } from "@/lib/actions/preview";
import { ROLE_COLOR } from "@/lib/domain";
import type { ClientRow, UserRole } from "@/lib/database.types";

const TITLES: Record<string, [string, string]> = {
  "/overview": ["Overview", "Recruitment at a glance"],
  "/pipeline": ["Candidate Pipeline", "Drag candidates across stages"],
  "/jobs": ["Open Jobs", "Active requisitions"],
  "/candidates": ["All Candidates", "Everyone in your ATS"],
  "/interviews": ["Interviews", "Upcoming & scheduled rounds"],
  "/offers": ["Offers", "Offer journey & status"],
  "/analytics": ["Analytics", "Funnel & sourcing insights"],
  "/team": ["Recruiting Team", "Recruiter load & performance"],
  "/talent": ["Talent Pool", "Sourced & ready candidates"],
  "/admin": ["Admin", "Users, clients & configuration"],
};

export function AppTopbar({
  effectiveRole,
  realRole,
  scopeLabel,
  clients,
}: {
  effectiveRole: UserRole;
  realRole: UserRole;
  scopeLabel: string;
  clients: ClientRow[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const { openCreateReq } = useShell();
  const [, start] = useTransition();

  const [title, sub] = TITLES[pathname] ?? ["ScoutforU", "Applicant Tracking"];
  const canWrite = effectiveRole !== "client";
  const isAdmin = realRole === "master_admin";

  const onSearch = (v: string) => {
    const p = new URLSearchParams(params.toString());
    if (v) p.set("q", v);
    else p.delete("q");
    router.replace(`${pathname}?${p.toString()}`);
  };

  const setPreview = (value: string) =>
    start(async () => {
      await setPreviewAction(value);
      router.refresh();
    });

  return (
    <header className="flex h-[66px] shrink-0 items-center gap-[18px] border-b border-[#e6eaf1] bg-white px-[26px]">
      <div className="shrink-0">
        <div className="whitespace-nowrap text-[18px] font-extrabold tracking-tight">
          {title}
        </div>
        <div className="whitespace-nowrap text-[12px] font-medium text-[#8a94a6]">
          {sub}
        </div>
      </div>
      <div className="min-w-[8px] flex-1" />

      <div className="relative flex min-w-[150px] max-w-[300px] flex-[1_1_240px] items-center">
        <Search
          size={16}
          className="pointer-events-none absolute left-[13px] text-[#9aa4b6]"
        />
        <input
          defaultValue={params.get("q") ?? ""}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search candidates, jobs, skills…"
          className="w-full rounded-[10px] border border-[#e3e8f0] bg-[#f6f8fb] py-2.5 pl-[38px] pr-3.5 text-[13.5px] font-medium outline-none focus:border-[#2a6fdb] focus:bg-white"
        />
      </div>

      {canWrite && (
        <button
          onClick={openCreateReq}
          className="flex shrink-0 items-center gap-[7px] whitespace-nowrap rounded-[10px] bg-[#2a6fdb] px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_3px_10px_rgba(42,111,219,.32)] hover:bg-[#1f5bc0]"
        >
          <Plus size={16} strokeWidth={2.4} />
          New Requisition
        </button>
      )}

      <button className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e6eaf1] text-[#5a6573] hover:bg-[#f6f8fb]">
        <Bell size={18} />
        <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-[#ef4444]" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-[9px] whitespace-nowrap rounded-[10px] border border-[#e6eaf1] bg-white py-1.5 pl-2 pr-[11px] hover:bg-[#f6f8fb]">
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            style={{ background: ROLE_COLOR[effectiveRole] }}
          />
          <div className="text-left">
            <div className="text-[12.5px] font-bold leading-tight">
              {effectiveRole === "master_admin"
                ? "Master Admin"
                : effectiveRole === "recruiter"
                  ? "Recruiter"
                  : "Client"}
            </div>
            <div className="text-[10.5px] font-semibold text-[#9aa4b6]">
              {scopeLabel}
            </div>
          </div>
          <ChevronDown size={15} className="text-[#9aa4b6]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[248px]">
          {isAdmin ? (
            <>
              <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9aa4b6]">
                Switch Role / View
              </div>
              <PreviewItem
                label="Master Admin"
                scope="Full access · all clients"
                color={ROLE_COLOR.master_admin}
                active={effectiveRole === "master_admin"}
                onClick={() => setPreview("master_admin")}
              />
              <PreviewItem
                label="Recruiter"
                scope="Preview · assigned roles"
                color={ROLE_COLOR.recruiter}
                active={effectiveRole === "recruiter"}
                onClick={() => setPreview("recruiter")}
              />
              {clients.map((c) => (
                <PreviewItem
                  key={c.id}
                  label="Client"
                  scope={`Preview · ${c.name}`}
                  color={ROLE_COLOR.client}
                  active={false}
                  onClick={() => setPreview(`client:${c.id}`)}
                />
              ))}
            </>
          ) : (
            <div className="px-2 py-1.5 text-[12px] font-semibold text-[#42506b]">
              {scopeLabel}
            </div>
          )}
          <DropdownMenuItem
            onClick={() => start(() => signOutAction())}
            className="mt-1 text-[13px] font-semibold text-[#dc2626]"
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function PreviewItem({
  label,
  scope,
  color,
  active,
  onClick,
}: {
  label: string;
  scope: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="gap-2.5 py-2">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color }}
      />
      <div className="flex-1">
        <div className="text-[13px] font-bold">{label}</div>
        <div className="text-[11px] font-medium text-[#9aa4b6]">{scope}</div>
      </div>
      {active && <Check size={16} className="text-[#2a6fdb]" />}
    </DropdownMenuItem>
  );
}
