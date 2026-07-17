"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { emailConfigured, sendMail } from "@/lib/email";
import { buildInvoicePdf } from "@/lib/invoice-doc";
import {
  computeTotals,
  addDays,
  nextRecurringDate,
  money,
  round2,
  type ItemInput,
} from "@/lib/invoice";
import type {
  InvoiceRow,
  InvoiceItemRow,
  InvoicePaymentRow,
  InvoiceRecurringRow,
  InvoiceTaxMode,
  PaymentMethod,
  RecurringFrequency,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string; id?: string };

function refresh() {
  revalidatePath("/", "layout");
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://scoutforu-ats.vercel.app"
  );
}

const escapeHtml = (s: string) =>
  (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);

// Billing is Master-Admin-only. RLS enforces this too; the explicit check
// gives a clear error instead of an empty-result mystery.
async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, user: null, me: null };
  const { data: me } = await sb
    .from("profiles")
    .select("id,name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "master_admin") return { sb, user, me: null };
  return { sb, user, me };
}

// ---- create / edit ----------------------------------------------------------

export type InvoiceForm = {
  clientId: string | null;
  billToName: string;
  billToEmail: string;
  billToAddress: string;
  billToGstin: string;
  issueDate: string; // yyyy-mm-dd
  paymentTermsDays: number;
  taxMode: InvoiceTaxMode;
  gstPercent: number;
  discountPercent: number;
  notes: string;
  terms: string;
  items: ItemInput[];
};

function cleanItems(items: ItemInput[]): ItemInput[] {
  return (items || [])
    .map((it) => ({
      description: (it.description || "").trim(),
      details: (it.details || "").trim(),
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
    }))
    .filter((it) => it.description || it.rate > 0);
}

export async function saveInvoice(id: string | null, form: InvoiceForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };

  const items = cleanItems(form.items);
  if (!form.billToName.trim()) return { ok: false, error: "Bill-to name is required." };
  if (!items.length) return { ok: false, error: "Add at least one line item." };
  if (!form.issueDate) return { ok: false, error: "Invoice date is required." };

  const t = computeTotals(items, form.discountPercent, form.gstPercent, form.taxMode);
  const payload = {
    client_id: form.clientId,
    bill_to_name: form.billToName.trim(),
    bill_to_email: form.billToEmail.trim(),
    bill_to_address: form.billToAddress.trim(),
    bill_to_gstin: form.billToGstin.trim(),
    issue_date: form.issueDate,
    due_date: addDays(form.issueDate, Math.max(0, form.paymentTermsDays)),
    payment_terms_days: Math.max(0, form.paymentTermsDays),
    tax_mode: form.taxMode,
    gst_percent: Number(form.gstPercent) || 0,
    discount_percent: Number(form.discountPercent) || 0,
    subtotal: t.subtotal,
    discount_amount: t.discount,
    tax_amount: t.tax,
    total: t.total,
    notes: form.notes.trim(),
    terms: form.terms.trim(),
    updated_at: new Date().toISOString(),
  };

  let invoiceId = id;
  if (id) {
    const { data: existing } = await sb.from("invoices").select("status").eq("id", id).single();
    if (!existing) return { ok: false, error: "Invoice not found." };
    if (["paid", "void", "written_off"].includes(existing.status))
      return { ok: false, error: "Paid, void or written-off invoices can't be edited." };
    const { error } = await sb.from("invoices").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await sb.from("invoice_items").delete().eq("invoice_id", id);
  } else {
    const { data: no, error: numErr } = await sb.rpc("next_invoice_number");
    if (numErr || !no) return { ok: false, error: numErr?.message || "Could not assign an invoice number — run migration 0019 first." };
    const { data: created, error } = await sb
      .from("invoices")
      .insert({ ...payload, invoice_no: no, created_by: me.id })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: error?.message || "Failed to create invoice." };
    invoiceId = created.id;
    await sb.from("invoice_events").insert({
      invoice_id: invoiceId,
      kind: "created",
      body: `Invoice ${no} created`,
      by_user_id: me.id,
    });
  }

  const { error: itemErr } = await sb.from("invoice_items").insert(
    items.map((it, i) => ({
      invoice_id: invoiceId!,
      description: it.description,
      details: it.details,
      qty: it.qty,
      rate: it.rate,
      amount: round2(it.qty * it.rate),
      sort: i,
    })),
  );
  if (itemErr) return { ok: false, error: itemErr.message };

  refresh();
  return { ok: true, id: invoiceId!, message: id ? "Invoice updated" : "Invoice created" };
}

export async function deleteInvoice(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { data: inv } = await sb.from("invoices").select("status").eq("id", id).single();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft" && inv.status !== "void")
    return { ok: false, error: "Only draft or void invoices can be deleted — void it first." };
  const { error } = await sb.from("invoices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Invoice deleted" };
}

export async function duplicateInvoice(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const [{ data: inv }, { data: items }] = await Promise.all([
    sb.from("invoices").select("*").eq("id", id).single(),
    sb.from("invoice_items").select("*").eq("invoice_id", id).order("sort"),
  ]);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const today = format(new Date(), "yyyy-MM-dd");
  return saveInvoice(null, {
    clientId: inv.client_id,
    billToName: inv.bill_to_name,
    billToEmail: inv.bill_to_email,
    billToAddress: inv.bill_to_address,
    billToGstin: inv.bill_to_gstin,
    issueDate: today,
    paymentTermsDays: inv.payment_terms_days,
    taxMode: inv.tax_mode,
    gstPercent: inv.gst_percent,
    discountPercent: inv.discount_percent,
    notes: inv.notes,
    terms: inv.terms,
    items: (items ?? []).map((it) => ({
      description: it.description,
      details: it.details,
      qty: it.qty,
      rate: it.rate,
    })),
  });
}

// ---- status changes ----------------------------------------------------------

export async function setInvoiceStatus(
  id: string,
  status: "void" | "written_off" | "draft",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { data: inv } = await sb
    .from("invoices")
    .select("status,amount_paid,invoice_no")
    .eq("id", id)
    .single();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (status === "void" && inv.amount_paid > 0)
    return { ok: false, error: "This invoice has recorded payments — delete them before voiding." };
  if (status === "draft" && inv.amount_paid > 0)
    return { ok: false, error: "Invoices with payments can't go back to draft." };

  const { error } = await sb
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await sb.from("invoice_events").insert({
    invoice_id: id,
    kind: "status",
    body:
      status === "void"
        ? "Invoice voided"
        : status === "written_off"
          ? "Balance written off"
          : "Reverted to draft",
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: `${inv.invoice_no}: ${status === "written_off" ? "written off" : status}` };
}

export async function markInvoiceSent(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { data: inv } = await sb.from("invoices").select("status,invoice_no").eq("id", id).single();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft") return { ok: false, error: "Only drafts can be marked as sent." };
  const { error } = await sb
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  await sb.from("invoice_events").insert({
    invoice_id: id,
    kind: "sent",
    body: "Marked as sent (outside the app)",
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: `${inv.invoice_no} marked as sent` };
}

// ---- email sending -------------------------------------------------------------

async function loadInvoiceBundle(sb: Awaited<ReturnType<typeof createClient>>, id: string) {
  const [{ data: inv }, { data: items }, { data: payments }, { data: org }, { data: settings }] =
    await Promise.all([
      sb.from("invoices").select("*").eq("id", id).single(),
      sb.from("invoice_items").select("*").eq("invoice_id", id).order("sort"),
      sb.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_on"),
      sb.from("organization").select("*").maybeSingle(),
      sb.from("invoice_settings").select("*").maybeSingle(),
    ]);
  return {
    inv: inv as InvoiceRow | null,
    items: (items ?? []) as InvoiceItemRow[],
    payments: (payments ?? []) as InvoicePaymentRow[],
    org,
    settings,
  };
}

function invoiceEmailHtml(opts: {
  orgName: string;
  invoiceNo: string;
  total: string;
  dueDate: string;
  viewUrl: string;
  message: string;
  senderName: string;
  reminder?: boolean;
}): string {
  const { orgName, invoiceNo, total, dueDate, viewUrl, message, senderName, reminder } = opts;
  return `<div style="font:14px/1.6 system-ui,Arial,sans-serif;color:#16203a;max-width:560px">
${message ? `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>` : ""}
<div style="border:1px solid #e3e8f0;border-radius:12px;padding:20px 22px;margin:14px 0">
  <div style="font-size:12px;color:#7a8696;font-weight:700;text-transform:uppercase;letter-spacing:.4px">${reminder ? "Payment reminder" : "Invoice"} from ${escapeHtml(orgName)}</div>
  <div style="font-size:20px;font-weight:800;margin-top:6px">${escapeHtml(invoiceNo)}</div>
  <div style="margin-top:10px;font-size:14px">Amount due: <b>${escapeHtml(total)}</b> &nbsp;·&nbsp; Due date: <b>${escapeHtml(dueDate)}</b></div>
  <a href="${viewUrl}" style="display:inline-block;margin-top:14px;background:#2a6fdb;color:#fff;text-decoration:none;font-weight:700;padding:10px 22px;border-radius:9px">View Invoice</a>
</div>
<p>The invoice PDF is attached to this email.</p>
<p style="color:#7a8699;font-size:12px">Sent by ${escapeHtml(senderName)} via ScoutforU Invoices.</p>
</div>`;
}

export async function sendInvoice(
  id: string,
  input: { to: string; cc?: string; subject?: string; message?: string; reminder?: boolean },
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const to = (input.to || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to))
    return { ok: false, error: "Enter a valid email address." };
  if (!emailConfigured())
    return {
      ok: false,
      error:
        "Email is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in the server env (see Admin → General Settings → Email).",
    };

  const { inv, items, payments, org, settings } = await loadInvoiceBundle(sb, id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (["void", "written_off"].includes(inv.status))
    return { ok: false, error: "This invoice is void/written off — it can't be sent." };

  const pdf = buildInvoicePdf({ invoice: inv, items, payments, org, settings });
  const viewUrl = `${siteUrl()}/invoice/${inv.public_token}`;
  const orgName = org?.name || "ScoutforU";
  const dueStr = inv.due_date ? format(new Date(inv.due_date + "T00:00:00"), "dd MMM yyyy") : "—";
  const balance = money(Math.max(0, inv.total - inv.amount_paid));
  const subject =
    (input.subject || "").trim() ||
    (input.reminder
      ? `Payment reminder — ${inv.invoice_no} (${balance} due)`
      : `Invoice ${inv.invoice_no} from ${orgName}`);

  try {
    await sendMail({
      to,
      cc: (input.cc || "").trim() || undefined,
      subject,
      html: invoiceEmailHtml({
        orgName,
        invoiceNo: inv.invoice_no,
        total: balance,
        dueDate: dueStr,
        viewUrl,
        message: (input.message || "").trim(),
        senderName: me.name,
        reminder: input.reminder,
      }),
      attachments: [
        {
          filename: `${inv.invoice_no}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send the email." };
  }

  const patch: Partial<InvoiceRow> = { updated_at: new Date().toISOString() };
  if (inv.status === "draft") {
    patch.status = "sent";
    patch.sent_at = new Date().toISOString();
  }
  await sb.from("invoices").update(patch).eq("id", id);
  await sb.from("invoice_events").insert({
    invoice_id: id,
    kind: input.reminder ? "reminder" : "sent",
    body: `${input.reminder ? "Reminder" : "Invoice"} emailed to ${to}`,
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: `${inv.invoice_no} ${input.reminder ? "reminder " : ""}sent to ${to}` };
}

// ---- payments -----------------------------------------------------------------

export type PaymentForm = {
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
};

async function recomputePaymentState(
  sb: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string,
) {
  const [{ data: inv }, { data: pays }] = await Promise.all([
    sb.from("invoices").select("total,status,paid_at").eq("id", invoiceId).single(),
    sb.from("invoice_payments").select("amount").eq("invoice_id", invoiceId),
  ]);
  if (!inv) return;
  const paid = round2((pays ?? []).reduce((s, p) => s + p.amount, 0));
  const patch: Partial<InvoiceRow> = {
    amount_paid: paid,
    updated_at: new Date().toISOString(),
  };
  if (!["void", "written_off", "draft"].includes(inv.status)) {
    if (paid >= inv.total - 0.01 && inv.total > 0) {
      patch.status = "paid";
      patch.paid_at = inv.paid_at ?? new Date().toISOString();
    } else if (paid > 0) {
      patch.status = "partial";
      patch.paid_at = null;
    } else {
      patch.status = "sent";
      patch.paid_at = null;
    }
  }
  await sb.from("invoices").update(patch).eq("id", invoiceId);
}

export async function recordPayment(invoiceId: string, form: PaymentForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const amount = round2(Number(form.amount));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid payment amount." };
  if (!form.paidOn) return { ok: false, error: "Payment date is required." };
  const { data: inv } = await sb
    .from("invoices")
    .select("status,total,amount_paid,invoice_no")
    .eq("id", invoiceId)
    .single();
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (["void", "written_off"].includes(inv.status))
    return { ok: false, error: "This invoice is void/written off." };
  if (inv.status === "draft")
    return { ok: false, error: "Send (or mark as sent) the invoice before recording payments." };
  const balance = round2(inv.total - inv.amount_paid);
  if (amount > balance + 0.01)
    return { ok: false, error: `Amount exceeds the balance due (${money(balance)}).` };

  const { error } = await sb.from("invoice_payments").insert({
    invoice_id: invoiceId,
    amount,
    paid_on: form.paidOn,
    method: form.method,
    reference: form.reference.trim(),
    notes: form.notes.trim(),
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  await recomputePaymentState(sb, invoiceId);
  await sb.from("invoice_events").insert({
    invoice_id: invoiceId,
    kind: "payment",
    body: `Payment of ${money(amount)} recorded (${form.method.replace(/_/g, " ")})${form.reference ? ` — ref ${form.reference.trim()}` : ""}`,
    by_user_id: me.id,
  });
  refresh();
  const nowPaid = amount >= balance - 0.01;
  return {
    ok: true,
    message: nowPaid
      ? `${inv.invoice_no} fully paid 🎉`
      : `Payment recorded — ${money(round2(balance - amount))} still due`,
  };
}

export async function deletePayment(paymentId: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { data: pay } = await sb
    .from("invoice_payments")
    .select("invoice_id,amount")
    .eq("id", paymentId)
    .single();
  if (!pay) return { ok: false, error: "Payment not found." };
  const { error } = await sb.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  await recomputePaymentState(sb, pay.invoice_id);
  await sb.from("invoice_events").insert({
    invoice_id: pay.invoice_id,
    kind: "payment",
    body: `Payment of ${money(pay.amount)} removed`,
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: "Payment removed" };
}

// ---- recurring profiles ---------------------------------------------------------

export type RecurringForm = {
  name: string;
  clientId: string | null;
  frequency: RecurringFrequency;
  nextDate: string;
  endDate: string | null;
  items: ItemInput[];
  taxMode: InvoiceTaxMode;
  gstPercent: number;
  discountPercent: number;
  paymentTermsDays: number;
  notes: string;
  terms: string;
};

export async function saveRecurring(id: string | null, form: RecurringForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const items = cleanItems(form.items);
  if (!form.name.trim()) return { ok: false, error: "Profile name is required." };
  if (!form.clientId) return { ok: false, error: "Pick the client to bill." };
  if (!items.length) return { ok: false, error: "Add at least one line item." };
  if (!form.nextDate) return { ok: false, error: "First invoice date is required." };

  const payload = {
    name: form.name.trim(),
    client_id: form.clientId,
    frequency: form.frequency,
    next_date: form.nextDate,
    end_date: form.endDate || null,
    items,
    tax_mode: form.taxMode,
    gst_percent: Number(form.gstPercent) || 0,
    discount_percent: Number(form.discountPercent) || 0,
    payment_terms_days: Math.max(0, form.paymentTermsDays),
    notes: form.notes.trim(),
    terms: form.terms.trim(),
  };
  const { error } = id
    ? await sb.from("invoice_recurring").update(payload).eq("id", id)
    : await sb.from("invoice_recurring").insert(payload);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: id ? "Recurring profile updated" : "Recurring profile created" };
}

export async function toggleRecurring(id: string, active: boolean): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { error } = await sb.from("invoice_recurring").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: active ? "Profile resumed" : "Profile paused" };
}

export async function deleteRecurring(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { error } = await sb.from("invoice_recurring").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Recurring profile deleted" };
}

async function generateFromProfile(
  sb: Awaited<ReturnType<typeof createClient>>,
  profile: InvoiceRecurringRow,
): Promise<Result> {
  const { data: client } = profile.client_id
    ? await sb
        .from("clients")
        .select("name,contact_email,address,city")
        .eq("id", profile.client_id)
        .maybeSingle()
    : { data: null };
  const res = await saveInvoice(null, {
    clientId: profile.client_id,
    billToName: client?.name || profile.name,
    billToEmail: client?.contact_email || "",
    billToAddress: [client?.address, client?.city].filter(Boolean).join(", "),
    billToGstin: "",
    issueDate: profile.next_date,
    paymentTermsDays: profile.payment_terms_days,
    taxMode: profile.tax_mode,
    gstPercent: profile.gst_percent,
    discountPercent: profile.discount_percent,
    notes: profile.notes,
    terms: profile.terms,
    items: profile.items,
  });
  if (!res.ok || !res.id) return res;

  const next = nextRecurringDate(profile.next_date, profile.frequency);
  const expired = profile.end_date != null && next > profile.end_date;
  await Promise.all([
    sb
      .from("invoices")
      .update({ recurring_id: profile.id })
      .eq("id", res.id),
    sb
      .from("invoice_recurring")
      .update({
        next_date: next,
        active: !expired,
        last_generated_at: new Date().toISOString(),
      })
      .eq("id", profile.id),
    sb.from("invoice_events").insert({
      invoice_id: res.id,
      kind: "created",
      body: `Draft generated by recurring profile “${profile.name}”`,
    }),
  ]);
  return res;
}

export async function generateRecurringNow(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage invoices." };
  const { data: profile } = await sb.from("invoice_recurring").select("*").eq("id", id).single();
  if (!profile) return { ok: false, error: "Profile not found." };
  const res = await generateFromProfile(sb, profile as InvoiceRecurringRow);
  if (res.ok) refresh();
  return res.ok ? { ...res, message: "Draft invoice generated" } : res;
}

// Lazy scheduler: called when the invoices dashboard loads. Generates a draft
// for every active profile whose next_date has arrived (serverless-friendly —
// no cron needed).
export async function generateDueRecurring(): Promise<number> {
  const { sb, me } = await requireAdmin();
  if (!me) return 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: due } = await sb
    .from("invoice_recurring")
    .select("*")
    .eq("active", true)
    .lte("next_date", today);
  let made = 0;
  for (const profile of (due ?? []) as InvoiceRecurringRow[]) {
    // Guard against loops: cap at 12 catch-up invoices per profile per load.
    let guard = 0;
    let p = profile;
    while (p.active && p.next_date <= today && guard < 12) {
      const res = await generateFromProfile(sb, p);
      if (!res.ok) break;
      made++;
      guard++;
      const { data: updated } = await sb
        .from("invoice_recurring")
        .select("*")
        .eq("id", profile.id)
        .single();
      if (!updated) break;
      p = updated as InvoiceRecurringRow;
    }
  }
  if (made) refresh();
  return made;
}
