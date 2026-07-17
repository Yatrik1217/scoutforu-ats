import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildInvoicePdf, fetchLogoBytes } from "@/lib/invoice-doc";
import type {
  InvoiceRow,
  InvoiceItemRow,
  InvoicePaymentRow,
  OrganizationRow,
  InvoiceSettingsRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Tokenized PDF download — used by the public invoice page, the admin detail
// page and as the email attachment source of truth.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[a-f0-9]{24,64}$/.test(token))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sb = createServiceClient();
  const { data: inv } = await sb
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: items }, { data: payments }, { data: org }, { data: settings }] =
    await Promise.all([
      sb.from("invoice_items").select("*").eq("invoice_id", inv.id).order("sort"),
      sb.from("invoice_payments").select("*").eq("invoice_id", inv.id).order("paid_on"),
      sb.from("organization").select("*").maybeSingle(),
      sb.from("invoice_settings").select("*").maybeSingle(),
    ]);

  const logoBytes = await fetchLogoBytes((org as OrganizationRow | null)?.logo_url);
  const pdf = buildInvoicePdf({
    invoice: inv as InvoiceRow,
    items: (items ?? []) as InvoiceItemRow[],
    payments: (payments ?? []) as InvoicePaymentRow[],
    org: org as OrganizationRow | null,
    settings: settings as InvoiceSettingsRow | null,
    logoBytes,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${(inv as InvoiceRow).invoice_no}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
