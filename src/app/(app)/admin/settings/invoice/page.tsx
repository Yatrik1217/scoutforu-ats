import Link from "next/link";
import { redirect } from "next/navigation";
import { loadWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { InvoiceSettingsForm } from "@/components/settings-modules";
import type { InvoiceSettingsRow } from "@/lib/database.types";

export default async function InvoiceSettingsPage() {
  const { scope } = await loadWorkspace();
  if (scope.role !== "master_admin") redirect("/admin");
  const sb = await createClient();
  const { data } = await sb.from("invoice_settings").select("*").maybeSingle();

  return (
    <div className="animate-sc-fadein mx-auto max-w-[720px] p-[22px_26px_40px]">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-[20px] font-extrabold text-[#16203a]">Invoice Setting</h1>
        <Link href="/admin/settings" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← General Settings
        </Link>
      </div>
      <p className="mb-5 text-[13px] text-[#8a94a6]">
        Billing details used on invoices — numbering, GST, PAN and bank information.
      </p>
      <InvoiceSettingsForm settings={(data as InvoiceSettingsRow) ?? null} />
    </div>
  );
}
