import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlacementEditor, type ClientLite, type CandidateLite, type RecruiterLite } from "@/components/placement-editor";
import type { PlacementRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EditPlacementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const sb = await createClient();
  const [{ data: placement }, { data: clients }, { data: cands }, { data: jobs }, { data: recruiters }, { data: settings }] =
    await Promise.all([
      sb.from("placements").select("*").eq("id", id).maybeSingle(),
      sb.from("clients").select("id,name").order("name"),
      sb
        .from("candidates")
        .select("id,name,current_designation,expected_ctc_lpa,job_id,recruiter_id,stage")
        .in("stage", ["offered", "offer_accepted", "joined"])
        .order("name"),
      sb.from("jobs").select("id,client_id"),
      sb.from("profiles").select("id,name").neq("role", "client").eq("active", true),
      sb.from("invoice_settings").select("gst_percent").maybeSingle(),
    ]);
  if (!placement) notFound();

  const jobClient = new Map((jobs ?? []).map((j) => [j.id, j.client_id]));
  const candidates: CandidateLite[] = (cands ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    designation: c.current_designation ?? "",
    expectedCtc: (c.expected_ctc_lpa ?? 0) * 100000,
    clientId: c.job_id ? (jobClient.get(c.job_id) ?? null) : null,
    jobId: c.job_id,
    recruiterId: c.recruiter_id,
  }));

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mx-auto mb-4 flex max-w-[980px] items-center justify-between">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          Edit Placement
        </h1>
        <Link
          href={`/placements/${id}`}
          className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline"
        >
          ← Back
        </Link>
      </div>
      <PlacementEditor
        clients={(clients ?? []) as ClientLite[]}
        candidates={candidates}
        recruiters={(recruiters ?? []) as RecruiterLite[]}
        gstDefault={settings?.gst_percent ?? 18}
        placement={placement as PlacementRow}
      />
    </div>
  );
}
