"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Building2,
  Wallet,
  Landmark,
  TrendingUp,
  Tags,
  CalendarClock,
  ArrowLeft,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { initials, avatarColor } from "@/lib/domain";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/finance", label: "Dashboard", icon: LayoutGrid },
  { href: "/finance/company", label: "Company P&L", icon: Building2 },
  { href: "/finance/personal", label: "Personal", icon: Wallet },
  { href: "/finance/upcoming", label: "Upcoming", icon: CalendarClock },
  { href: "/finance/emis", label: "EMIs & Loans", icon: Landmark },
  { href: "/finance/investments", label: "Investments", icon: TrendingUp },
  { href: "/finance/categories", label: "Categories", icon: Tags },
];

export function FinanceSidebar({ name }: { name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed left-3 top-[13px] z-30 flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#0e1320] text-white shadow-lg md:hidden"
      >
        <Menu size={19} />
      </button>
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/50 md:hidden" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[248px] shrink-0 flex-col bg-[#0e1320] p-[20px_14px] transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
      {/* logo */}
      <div className="flex shrink-0 items-center gap-[11px] px-2 pt-1.5 pb-[18px]">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] shadow-[0_4px_14px_rgba(16,163,74,.45)]"
          style={{ background: "linear-gradient(135deg,#16a34a,#22c55e)" }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1v22" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[17px] font-bold leading-none tracking-tight text-white">
            ScoutforU
          </div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5d6b85]">
            Finance
          </div>
        </div>
      </div>

      <nav className="sc-scroll -mr-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-2">
        <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[1px] text-[#4a566f]">
          Money
        </div>
        {NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="px-2.5 pt-3.5 pb-1 text-[10px] font-bold uppercase tracking-[1px] text-[#4a566f]">
          Switch
        </div>
        <Link
          href="/overview"
          className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold text-[#8c99b3] transition hover:brightness-135"
        >
          <ArrowLeft size={18} strokeWidth={2} />
          <span className="flex-1">Back to ATS</span>
        </Link>
      </nav>

      {/* user card */}
      <div className="mt-1.5 flex shrink-0 items-center gap-2.5 rounded-xl bg-[#171d2e] p-[11px_10px]">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: avatarColor(name) }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-[#e8edf6]">{name}</div>
          <div className="text-[11px] font-medium text-[#6b7a96]">Owner</div>
        </div>
      </div>
      </aside>
    </>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  // exact match for the dashboard root, prefix match for the rest
  const active =
    item.href === "/finance"
      ? pathname === "/finance"
      : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] transition ${
        active
          ? "font-bold text-white shadow-[0_4px_14px_rgba(16,163,74,.4)]"
          : "font-semibold text-[#8c99b3] hover:brightness-135"
      }`}
      style={active ? { background: "linear-gradient(90deg,#16a34a,#22c55e)" } : undefined}
    >
      <Icon size={18} strokeWidth={2} />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}
