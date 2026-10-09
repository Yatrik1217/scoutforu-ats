import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/data";
import {
  submissionsForJob,
  buildSubmissionsWorkbook,
} from "@/lib/submissions-tracker";
import type { EffectiveScope } from "@/lib/preview";
import type { ClientRow, OrganizationRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Submissions tracker (.xlsx) for ONE opening — the candidates submitted to the
// client for that specific role, to share with the client. Available to any
// signed-in staff member (admins + recruiters), never to a client login. Built
// from a service-role workspace so it's the complete list for the role,
// regardless of who downloads it.
//   GET /api/submissions-tracker/<jobId>
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
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
  if (!me || me.role === "client")
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const scope: EffectiveScope = {
    role: "master_admin",
    realRole: "master_admin",
    isPreview: false,
    previewClientId: null,
    userId: user.id,
    scopeLabel: "tracker",
  };
  const ws = await getWorkspace(scope, createServiceClient());

  const job = ws.jobById.get(jobId) ?? ws.jobs.find((j) => j.id === jobId);
  if (!job) return NextResponse.json({ error: "Opening not found" }, { status: 404 });
  const client = ws.clients.find((c) => c.id === job.client_id) ?? null;

  const rows = submissionsForJob(ws, jobId);
  const { data: org } = await sb.from("organization").select("*").maybeSingle();

  const bytes = await buildSubmissionsWorkbook({
    client: (client ?? ({ name: "—" } as ClientRow)),
    org: (org as OrganizationRow | null) ?? null,
    rows,
    jobTitle: job.title,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `Submissions - ${client?.name ?? "—"} - ${job.title} - ${stamp}`.replace(
    /[^\w .-]+/g,
    " ",
  );

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
