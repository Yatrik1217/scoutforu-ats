import { cookies } from "next/headers";
import type { ProfileRow, UserRole } from "@/lib/database.types";
import { ROLE_LABEL } from "@/lib/domain";

const PREVIEW_COOKIE = "sc_preview";

export type EffectiveScope = {
  role: UserRole; // role the UI should behave as
  realRole: UserRole; // the user's true role
  isPreview: boolean; // admin previewing a non-admin role
  previewClientId: string | null; // when previewing as a client
  scopeLabel: string; // topbar caption
};

// The real role is the source of truth for security (RLS). Preview only ever
// *narrows* what a Master Admin sees in the UI — it can never widen a
// recruiter's or client's access.
export async function getEffectiveScope(
  profile: ProfileRow,
  clients?: { id: string; name: string }[],
): Promise<EffectiveScope> {
  const base: EffectiveScope = {
    role: profile.role,
    realRole: profile.role,
    isPreview: false,
    previewClientId: profile.client_id,
    scopeLabel:
      profile.role === "master_admin"
        ? "Full access · all clients"
        : profile.role === "recruiter"
          ? `${profile.name} · assigned roles`
          : "Read-only · your pipelines",
  };

  if (profile.role !== "master_admin") return base;

  const store = await cookies();
  const raw = store.get(PREVIEW_COOKIE)?.value;
  if (!raw || raw === "master_admin") return base;

  const [role, clientId] = raw.split(":") as [UserRole, string | undefined];
  if (role === "recruiter") {
    return {
      role: "recruiter",
      realRole: "master_admin",
      isPreview: true,
      previewClientId: null,
      scopeLabel: "Preview · Recruiter",
    };
  }
  if (role === "client") {
    const client = clients?.find((c) => c.id === clientId);
    return {
      role: "client",
      realRole: "master_admin",
      isPreview: true,
      previewClientId: clientId ?? null,
      scopeLabel: `Preview · ${client?.name ?? "Client"}`,
    };
  }
  return base;
}

export function roleScopeCaption(role: UserRole, name: string): string {
  if (role === "master_admin") return "Full access · all clients";
  if (role === "recruiter") return `${name} · assigned roles`;
  return ROLE_LABEL.client;
}
