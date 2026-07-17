import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RecurringManager } from "@/components/recurring-manager";
import type { InvoiceRecurringRow, InvoiceSettingsRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const sb = await createClient();
  const [{ data: profiles }, { data: clients }, { data: settings }] = await Promise.all([
    sb.from("invoice_recurring").select("*").order("next_date"),
    sb.from("clients").select("id,name,contact_email,address,city").order("name"),
    sb.from("invoice_settings").select("*").maybeSingle(),
  ]);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Recurring Invoices
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Repeat billing profiles — a draft invoice is generated automatically each time the next
            date arrives (retainers, monthly sourcing fees…).
          </p>
        </div>
        <Link href="/invoices" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← Invoices
        </Link>
      </div>
      <RecurringManager
        profiles={(profiles ?? []) as InvoiceRecurringRow[]}
        clients={(clients ?? []) as { id: string; name: string; contact_email: string | null; address: string; city: string }[]}
        settings={(settings as InvoiceSettingsRow) ?? null}
      />
    </div>
  );
}
