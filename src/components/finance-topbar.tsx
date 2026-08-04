"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/lib/actions/auth";

const TITLES: Record<string, [string, string]> = {
  "/finance": ["Finance Dashboard", "Personal & company money at a glance"],
  "/finance/company": ["Company P&L", "ScoutforU revenue, expenses & EBITDA"],
  "/finance/personal": ["Personal", "Home, fuel, EMIs & everyday spend"],
  "/finance/upcoming": ["Upcoming payments", "Everything due in the next 30 days"],
  "/finance/emis": ["EMIs & Loans", "Loans & insurance premiums — what's due"],
  "/finance/investments": ["Investments", "SIPs & assets — tracked apart from expenses"],
  "/finance/categories": ["Categories", "Organise your expense heads"],
};

export function FinanceTopbar() {
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [title, sub] = TITLES[pathname] ?? ["Finance", "ScoutforU"];

  return (
    <header className="flex h-[66px] shrink-0 items-center gap-[18px] border-b border-[#e6eaf1] bg-white px-[26px] max-md:pl-[64px]">
      <div className="shrink-0">
        <div className="whitespace-nowrap text-[18px] font-extrabold tracking-tight">{title}</div>
        <div className="whitespace-nowrap text-[12px] font-medium text-[#8a94a6]">{sub}</div>
      </div>
      <div className="min-w-[8px] flex-1" />
      <div className="flex items-center gap-2.5 rounded-[10px] border border-[#e6eaf1] bg-white py-1.5 pl-3 pr-2">
        <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-[#16a34a]" />
        <span className="text-[12.5px] font-bold">Owner</span>
        <button
          onClick={() => start(() => signOutAction())}
          disabled={pending}
          className="ml-1.5 rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
