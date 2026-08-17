import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PipelineManager } from "@/components/pipeline-manager";
import type { PipelineStageRow } from "@/lib/pipeline";

export default async function PipelineSettingsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");

  const sb = await createClient();
  const [{ data: stageData }, { data: clientData }] = await Promise.all([
    sb.from("pipeline_stages").select("*").order("position"),
    sb.from("clients").select("id, name").order("name"),
  ]);
  const stages = (stageData ?? []) as PipelineStageRow[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  return (
    <div className="animate-sc-fadein mx-auto max-w-[760px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Application Pipeline</h1>
        <Link
          href="/admin/settings"
          className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline"
        >
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        The stages candidates move through. Edit the <b>Default</b> pipeline everyone uses, or give a
        specific client its own — e.g. <i>HR → 1st Tech → 2nd Tech → CEO Round → Salary discussion</i>.
        Each stage&apos;s <b>outcome</b> tells reports what it means (In progress, Won, or Lost).
      </p>
      <PipelineManager stages={stages} clients={clients} />
    </div>
  );
}
