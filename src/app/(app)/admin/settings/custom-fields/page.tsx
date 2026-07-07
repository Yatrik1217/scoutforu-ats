import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { CustomFieldsManager } from "@/components/custom-fields-manager";
import type { CustomFieldRow } from "@/lib/database.types";

export default async function CustomFieldsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const { data } = await sb.from("custom_fields").select("*").order("sort").order("created_at");
  const fields = (data ?? []) as CustomFieldRow[];

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Custom Fields</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Add your own fields to candidates, jobs and clients. Candidate fields appear in the candidate
        form and profile.
      </p>
      <CustomFieldsManager fields={fields} />
    </div>
  );
}
