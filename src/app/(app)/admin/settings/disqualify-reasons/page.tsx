import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { DisqualifyReasonsManager } from "@/components/disqualify-reasons-manager";
import type { DisqualifyReasonRow } from "@/lib/database.types";

export default async function DisqualifyReasonsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const { data } = await sb
    .from("disqualify_reasons")
    .select("*")
    .order("active", { ascending: false })
    .order("sort")
    .order("label");
  const reasons = (data ?? []) as DisqualifyReasonRow[];

  return (
    <div className="animate-sc-fadein mx-auto max-w-[680px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Disqualify Reasons</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        These appear as a dropdown when you reject a candidate. Inactive reasons stay hidden but keep past history.
      </p>
      <DisqualifyReasonsManager reasons={reasons} />
    </div>
  );
}
