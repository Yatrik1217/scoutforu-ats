"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Columns3,
  Briefcase,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Search,
  UploadCloud,
  UserCheck,
  Database,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { initials, avatarColor, ROLE_LABEL } from "@/lib/domain";
import type { UserRole } from "@/lib/database.types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export function AppSidebar({
  name,
  role,
  jobsCount,
  interviewsCount,
}: {
  name: string;
  role: UserRole;
  jobsCount: number;
  interviewsCount: number;
}) {
  const pathname = usePathname();

  const workspace: NavItem[] = [
    { href: "/overview", label: "Overview", icon: LayoutGrid },
    { href: "/pipeline", label: "Pipeline", icon: Columns3 },
    { href: "/jobs", label: "Open Jobs", icon: Briefcase, badge: jobsCount },
    { href: "/candidates", label: "Candidates", icon: Users },
    { href: "/search", label: "Search Resumes", icon: Search },
    { href: "/bulk", label: "Bulk Upload", icon: UploadCloud },
    {
      href: "/interviews",
      label: "Interviews",
      icon: Calendar,
      badge: interviewsCount,
    },
    { href: "/offers", label: "Offers", icon: FileText },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const admin: NavItem[] = [
    { href: "/team", label: "Team", icon: UserCheck },
    { href: "/talent", label: "Talent Pool", icon: Database },
    { href: "/admin", label: "Admin", icon: SlidersHorizontal },
  ];

  const showAdmin = role !== "client";

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-1.5 bg-[#0e1320] p-[20px_14px]">
      {/* logo */}
      <div className="flex items-center gap-[11px] px-2 pt-1.5 pb-[18px]">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] shadow-[0_4px_14px_rgba(42,111,219,.45)]"
          style={{ background: "linear-gradient(135deg,#2A6FDB,#5b96f0)" }}
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
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-6" />
          </svg>
        </div>
        <div>
          <div className="font-display text-[17px] font-bold leading-none tracking-tight text-white">
            ScoutforU
          </div>
          <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#5d6b85]">
            ATS Platform
          </div>
        </div>
      </div>

      <SectionLabel>Workspace</SectionLabel>
      {workspace.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      {showAdmin && (
        <>
          <SectionLabel className="pt-3.5">Administration</SectionLabel>
          {admin.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </>
      )}

      {/* user card */}
      <div className="mt-auto flex items-center gap-2.5 rounded-xl bg-[#171d2e] p-[11px_10px]">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: avatarColor(name) }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-bold text-[#e8edf6]">
            {name}
          </div>
          <div className="text-[11px] font-medium text-[#6b7a96]">
            {ROLE_LABEL[role]}
          </div>
        </div>
      </div>
    </aside>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[1px] text-[#4a566f] ${className}`}
    >
      {children}
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13.5px] transition ${
        active
          ? "font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.4)]"
          : "font-semibold text-[#8c99b3] hover:brightness-135"
      }`}
      style={
        active
          ? { background: "linear-gradient(90deg,#2A6FDB,#3f7ee0)" }
          : undefined
      }
    >
      <Icon size={18} strokeWidth={2} />
      <span className="flex-1">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span
          className="tf-num rounded-full px-2 py-px text-[11px] font-extrabold"
          style={
            active
              ? { background: "rgba(255,255,255,.25)", color: "#fff" }
              : { background: "#1c2438", color: "#7e8cab" }
          }
        >
          {item.badge}
        </span>
      )}
    </Link>
  );
}
