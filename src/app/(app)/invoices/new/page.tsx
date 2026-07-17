import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceEditor, type ClientLite } from "@/components/invoice-editor";
import type { InvoiceSettingsRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const sb = await createClient();
  const [{ data: clients }, { data: settings }] = await Promise.all([
    sb.from("clients").select("id,name,contact_email,address,city").order("name"),
    sb.from("invoice_settings").select("*").maybeSingle(),
  ]);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mx-auto mb-4 flex max-w-[980px] items-center justify-between">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          New Invoice
        </h1>
        <Link href="/invoices" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← Invoices
        </Link>
      </div>
      <InvoiceEditor
        clients={(clients ?? []) as ClientLite[]}
        settings={(settings as InvoiceSettingsRow) ?? null}
      />
    </div>
  );
}
