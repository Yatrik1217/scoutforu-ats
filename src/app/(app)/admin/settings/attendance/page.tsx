import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AttendanceSettingsForm } from "@/components/attendance-settings-form";
import type { AttendanceSettingsRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function AttendanceSettingsPage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const { data } = await sb.from("attendance_settings").select("*").maybeSingle();

  return (
    <div className="animate-sc-fadein mx-auto max-w-[640px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Working Hours</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Your standard shift. Attendance uses it to flag late arrivals and short days under{" "}
        <Link href="/attendance" className="font-bold text-[#2a6fdb] hover:underline">Attendance</Link>.
      </p>
      <AttendanceSettingsForm settings={(data as AttendanceSettingsRow) ?? null} />
    </div>
  );
}
