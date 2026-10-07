import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadWorkspace } from "@/lib/data";
import {
  submissionsForClient,
  buildSubmissionsWorkbook,
} from "@/lib/submissions-tracker";
import type { OrganizationRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Client submissions tracker (.xlsx). Master Admin only — it spans every
// recruiter's candidates for the client, so it must not be exposed to a
// recruiter (who only sees their own) or a client login.
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

  const { ws, scope } = await loadWorkspace();
  if (scope.role !== "master_admin")
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

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
