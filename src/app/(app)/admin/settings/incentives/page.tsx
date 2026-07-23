import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { IncentiveSettingsForm } from "@/components/incentive-settings";
import type { IncentiveSettingsRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function IncentiveSettingsPage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const [{ data: settings }, { data: recruiters }] = await Promise.all([
    sb.from("incentive_settings").select("*").maybeSingle(),
    sb
      .from("profiles")
      .select("id,name,email,incentive_percent")
      .neq("role", "client")
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Recruiter Incentives</h1>
        <Link
          href="/admin/settings"
          className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline"
        >
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        How recruiter incentives are calculated on the placement fees they bill. Results show up
        under <Link href="/performance" className="font-bold text-[#2a6fdb] hover:underline">Performance</Link>.
      </p>
      <IncentiveSettingsForm
        settings={(settings as IncentiveSettingsRow) ?? null}
        recruiters={recruiters ?? []}
      />
    </div>
  );
}
