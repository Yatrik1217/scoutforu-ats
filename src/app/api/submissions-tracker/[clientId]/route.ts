import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import {
  submissionsForClient,
  buildSubmissionsWorkbook,
} from "@/lib/submissions-tracker";
import type { EffectiveScope } from "@/lib/preview";
import type { OrganizationRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Client submissions tracker (.xlsx). Available to any signed-in staff member
// (admins and recruiters) — NOT to a client login. It always returns the FULL
// client tracker (every recruiter's candidates for that client), so it is built
// from a service-role workspace rather than the caller's own scoped view.
//   GET /api/submissions-tracker/<clientId>
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  // Clients must never pull the internal submissions tracker.
  if (!me || me.role === "client")
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  // Full, unscoped workspace (all recruiters' candidates) so the tracker is the
  // complete client list regardless of who is downloading it.
  const scope: EffectiveScope = {
    role: "master_admin",
    realRole: "master_admin",
    isPreview: false,
    previewClientId: null,
    userId: user.id,
    scopeLabel: "tracker",
  };
  const ws = await getWorkspace(scope, createServiceClient());

  const client = ws.clients.find((c) => c.id === clientId);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const rows = submissionsForClient(ws, clientId);
  const { data: org } = await sb.from("organization").select("*").maybeSingle();

  const bytes = await buildSubmissionsWorkbook({
    client,
    org: (org as OrganizationRow | null) ?? null,
    rows,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `Submissions - ${client.name} - ${stamp}`.replace(/[^\w .-]+/g, " ");

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
