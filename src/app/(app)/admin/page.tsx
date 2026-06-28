import { Building2 } from "lucide-react";
import { loadWorkspace } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/domain";
import { Avatar } from "@/components/bits";
import { SettingsToggle, UserActiveToggle } from "@/components/view-actions";
import type { UserRole } from "@/lib/database.types";

const ROLE_BADGE: Record<UserRole, { color: string; bg: string }> = {
  master_admin: { color: "#2a6fdb", bg: "#eef4fe" },
  recruiter: { color: "#8b5cf6", bg: "#f3eefe" },
  client: { color: "#f59e0b", bg: "#fff7e6" },
};

const SETTINGS: {
  key: "email_notif" | "auto_reject" | "client_portal" | "two_factor";
  label: string;
  desc: string;
}[] = [
  { key: "email_notif", label: "Email Notifications", desc: "Notify recruiters on stage changes" },
  { key: "auto_reject", label: "Auto-reject stale", desc: "Reject candidates idle > 30 days" },
  { key: "client_portal", label: "Client Portal Access", desc: "Let clients view their pipelines" },
  { key: "two_factor", label: "Two-Factor Auth", desc: "Require 2FA for all admins" },
];

export default async function AdminPage() {
  const { ws, scope } = await loadWorkspace();
  const users = Array.from(ws.profileById.values()).sort((a, b) =>
    a.role === "master_admin" ? -1 : b.role === "master_admin" ? 1 : 0,
  );
  const isAdmin = scope.role === "master_admin";
  const s = ws.settings;

  return (
    <div className="animate-sc-fadein grid grid-cols-[1.2fr_1fr] gap-[18px] p-[22px_26px_40px]">
      <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="mb-4 text-[15.5px] font-extrabold">Users &amp; Roles</div>
        {users.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 border-b border-[#f0f3f8] py-[11px] last:border-0"
          >
            <Avatar name={u.name} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-bold">{u.name}</span>
                {!u.active && (
                  <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-[10px] font-bold text-[#dc2626]">
                    Inactive
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-[#9aa4b6]">{u.email}</div>
            </div>
            {isAdmin && u.role === "recruiter" && (
              <UserActiveToggle id={u.id} active={u.active} />
            )}
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                color: ROLE_BADGE[u.role].color,
                background: ROLE_BADGE[u.role].bg,
              }}
            >
              {ROLE_LABEL[u.role]}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 text-[15.5px] font-extrabold">Clients</div>
          {ws.clients.map((c) => {
            const jobs = ws.jobs.filter((j) => j.client_id === c.id);
            const cands = ws.candidates.filter((x) =>
              jobs.some((j) => j.id === x.job_id),
            ).length;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 border-b border-[#f0f3f8] py-2.5 last:border-0"
              >
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-[#eef4fe] text-[#2a6fdb]">
                  <Building2 size={17} />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-bold">{c.name}</div>
                  <div className="text-[11.5px] text-[#9aa4b6]">
                    {jobs.length} roles · {cands} candidates
                  </div>
                </div>
                <span className="rounded-full bg-[#e9f9ef] px-2.5 py-1 text-[11px] font-bold text-[#16a34a]">
                  {c.status}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-2 text-[15.5px] font-extrabold">Settings</div>
          {SETTINGS.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 border-b border-[#f0f3f8] py-3 last:border-0"
            >
              <div className="flex-1">
                <div className="text-[13.5px] font-bold">{item.label}</div>
                <div className="text-[11.5px] text-[#9aa4b6]">{item.desc}</div>
              </div>
              <SettingsToggle
                settingKey={item.key}
                initial={s ? Boolean(s[item.key]) : false}
                disabled={!isAdmin}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
