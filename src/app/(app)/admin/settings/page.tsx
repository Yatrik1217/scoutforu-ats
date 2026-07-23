import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { emailConfigured } from "@/lib/email";
import {
  Building2,
  GitBranch,
  Users,
  UsersRound,
  ShieldCheck,
  MessageSquareText,
  Mail,
  Send,
  Workflow,
  Zap,
  Ban,
  Columns3,
  ReceiptIndianRupee,
  Trophy,
  Upload,
  FileText,
  Globe,
  KeyRound,
  Building,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tile = {
  title: string;
  subtitle: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  href?: string;
  status?: "active" | "planned";
};

export default async function GeneralSettingsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const smtp = emailConfigured();

  const tiles: Tile[] = [
    { title: "Organization Info", subtitle: "Your organization details", desc: "Company name, logo, address & branding used across the ATS.", icon: Building2, color: "#e8833a", href: "/admin/settings/organization" },
    { title: "Branches", subtitle: "Manage branches / units", desc: "Multiple offices, divisions or business units.", icon: Building, color: "#e8833a", href: "/admin/settings/organization" },
    { title: "Recruiters", subtitle: "Your recruiter accounts", desc: "Add, activate or deactivate recruiter logins.", icon: Users, color: "#2a6fdb", href: "/admin" },
    { title: "Clients", subtitle: "Your client companies", desc: "Manage client companies, contacts & KAMs.", icon: UsersRound, color: "#38a3e0", href: "/admin" },
    { title: "Approvers", subtitle: "Internal approvers", desc: "Approve job openings before they go live.", icon: ShieldCheck, color: "#17a673", href: "/admin/settings/approvers" },
    { title: "SMS Settings", subtitle: "SMS gateway", desc: "Configure an SMS gateway for candidate alerts.", icon: MessageSquareText, color: "#38a3e0", href: "/admin/settings/sms" },
    { title: "Email (SMTP)", subtitle: smtp ? "Configured ✓" : "Not configured", desc: "Send trackers & résumés to clients from your mailbox.", icon: Mail, color: "#e0533a", href: "/admin/settings/email" },
    { title: "Default Emails", subtitle: "Templates & senders", desc: "Reusable email templates for common actions.", icon: Send, color: "#38a3e0", href: "/admin/settings/email-templates" },
    { title: "Application Pipeline", subtitle: "Recruitment workflow", desc: "The 9-stage hiring pipeline candidates move through.", icon: Workflow, color: "#e0533a", href: "/pipeline" },
    { title: "Action Triggers", subtitle: "Automations", desc: "Auto-reject stale candidates, notify on stage change.", icon: Zap, color: "#e8833a", href: "/admin" },
    { title: "Disqualify Reasons", subtitle: "Rejection reasons", desc: "Standard reasons used when rejecting candidates.", icon: Ban, color: "#e0533a", href: "/admin/settings/disqualify-reasons" },
    { title: "Custom Fields", subtitle: "Extra columns", desc: "Add your own fields to candidates, jobs & clients.", icon: Columns3, color: "#38a3e0", href: "/admin/settings/custom-fields" },
    { title: "Invoice Setting", subtitle: "Billing details", desc: "Invoice numbering, GST & billing info — invoices live under Admin → Invoices.", icon: ReceiptIndianRupee, color: "#e0533a", href: "/admin/settings/invoice" },
    { title: "Recruiter Incentives", subtitle: "Commission scheme", desc: "How recruiter incentives are calculated on placement fees — flat % or slabs, on money collected or fee booked.", icon: Trophy, color: "#17a673", href: "/admin/settings/incentives" },
    { title: "Import Data", subtitle: "Import from Excel", desc: "Candidates, jobs, clients & recruiter logins from .xlsx/.csv — plus AI résumé bulk upload.", icon: Upload, color: "#17a673", href: "/admin/settings/import" },
    { title: "File Name Formats", subtitle: "Résumé naming", desc: "Downloads are named by the candidate — active.", icon: FileText, color: "#e8833a", status: "active" },
    { title: "Résumé Import Token", subtitle: "Naukri Resdex", desc: "API token for the one-click Resdex import extension.", icon: KeyRound, color: "#2a6fdb", href: "/admin" },
    { title: "Career Page", subtitle: "Website & custom domain", desc: "Publish roles to careers.scoutforu.com and embed them on your website.", icon: Globe, color: "#38a3e0", href: "/admin/settings/career-page" },
  ];

  return (
    <div className="animate-sc-fadein p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold text-[#16203a]">General Settings</h1>
        <Link href="/admin" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← Back to Admin
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Configure your workspace. Tiles marked <PlannedPill /> are on the roadmap — tell me which to build next.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {tiles.map((t) => (
          <TileCard key={t.title} tile={t} />
        ))}
      </div>
    </div>
  );
}

function PlannedPill() {
  return (
    <span className="mx-0.5 rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-bold text-[#dc2626]">
      Planned
    </span>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  const planned = tile.status === "planned";
  const inner = (
    <div
      className={`flex items-stretch gap-0 overflow-hidden rounded-[12px] border border-[#e9edf3] bg-white transition ${
        planned ? "opacity-75" : "hover:border-[#cbd7ea] hover:shadow-[0_6px_20px_rgba(20,32,58,.08)]"
      }`}
    >
      <div
        className="flex w-[76px] shrink-0 items-center justify-center"
        style={{ background: tile.color }}
      >
        <Icon size={30} color="#fff" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1 p-[13px_16px]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: tile.color }}>
            {tile.title}
          </span>
          {planned && <PlannedPill />}
          {tile.status === "active" && (
            <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-bold text-[#17a673]">
              Active
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[13.5px] font-extrabold text-[#16203a]">{tile.subtitle}</div>
        <div className="mt-0.5 text-[12px] leading-snug text-[#8a94a6]">{tile.desc}</div>
      </div>
    </div>
  );
  if (planned || !tile.href) return inner;
  return <Link href={tile.href}>{inner}</Link>;
}
