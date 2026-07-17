import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InvoiceEditor, type ClientLite } from "@/components/invoice-editor";
import type { InvoiceRow, InvoiceItemRow, InvoiceSettingsRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const sb = await createClient();
  const [{ data: invoice }, { data: items }, { data: clients }, { data: settings }] =
    await Promise.all([
      sb.from("invoices").select("*").eq("id", id).maybeSingle(),
      sb.from("invoice_items").select("*").eq("invoice_id", id).order("sort"),
      sb.from("clients").select("id,name,contact_email,address,city").order("name"),
      sb.from("invoice_settings").select("*").maybeSingle(),
    ]);
  if (!invoice) notFound();
  if (["paid", "void", "written_off"].includes(invoice.status)) redirect(`/invoices/${id}`);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mx-auto mb-4 flex max-w-[980px] items-center justify-between">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          Edit {invoice.invoice_no}
        </h1>
        <Link
          href={`/invoices/${id}`}
          className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline"
        >
          ← Back to invoice
        </Link>
      </div>
      <InvoiceEditor
        clients={(clients ?? []) as ClientLite[]}
        settings={(settings as InvoiceSettingsRow) ?? null}
        invoice={invoice as InvoiceRow}
        items={(items ?? []) as InvoiceItemRow[]}
      />
    </div>
  );
}
