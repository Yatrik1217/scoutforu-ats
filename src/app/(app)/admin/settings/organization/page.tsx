import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm, BranchesManager } from "@/components/organization-settings";
import type { OrganizationRow, BranchRow } from "@/lib/database.types";

export default async function OrganizationPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const [{ data: org }, { data: branches }] = await Promise.all([
    sb.from("organization").select("*").maybeSingle(),
    sb.from("branches").select("*").order("active", { ascending: false }).order("sort").order("name"),
  ]);

  return (
    <div className="animate-sc-fadein mx-auto max-w-[760px] space-y-4 p-[22px_26px_40px]">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Organization &amp; Branches</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <OrganizationForm org={(org as OrganizationRow) ?? null} />
      <BranchesManager branches={(branches ?? []) as BranchRow[]} />
    </div>
  );
}
