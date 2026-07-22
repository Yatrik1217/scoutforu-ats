"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { money, round2 } from "@/lib/invoice";
import { computeFee, addDaysISO, netPayable } from "@/lib/placement";
import { saveInvoice } from "@/lib/actions/invoices";
import type {
  PlacementRow,
  PlacementFeeMode,
  PlacementTdsBase,
  PaymentMethod,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string; id?: string };

function refresh() {
  revalidatePath("/", "layout");
}

// Billing is Master-Admin-only; RLS enforces it, this gives a clear message.
async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, me: null };
  const { data: me } = await sb
    .from("profiles")
    .select("id,name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "master_admin") return { sb, me: null };
  return { sb, me };
}

// ---- create / edit -----------------------------------------------------------

export type PlacementForm = {
  candidateId: string | null;
  candidateName: string;
  position: string;
  clientId: string | null;
  clientName: string;
  jobId: string | null;
  recruiterId: string | null;
  joiningDate: string; // yyyy-mm-dd
  feeMode: PlacementFeeMode;
  annualCtc: number;
  feePercent: number;
  flatFee: number;
  gstApplicable: boolean;
  gstPercent: number;
  tdsApplicable: boolean;
  tdsPercent: number;
  tdsOn: PlacementTdsBase;
  creditDays: number;
  replacementDays: number;
  notes: string;
};

function buildPayload(form: PlacementForm) {
  const { fee, gst, total, tds, net } = computeFee({
    feeMode: form.feeMode,
    annualCtc: form.annualCtc,
    feePercent: form.feePercent,
    flatFee: form.flatFee,
    gstApplicable: form.gstApplicable,
    gstPercent: form.gstPercent,
    tdsApplicable: form.tdsApplicable,
    tdsPercent: form.tdsPercent,
    tdsOn: form.tdsOn,
  });
  return {
    candidate_id: form.candidateId,
    candidate_name: form.candidateName.trim(),
    position: form.position.trim(),
    client_id: form.clientId,
    client_name: form.clientName.trim(),
    job_id: form.jobId,
    recruiter_id: form.recruiterId,
    joining_date: form.joiningDate,
    fee_mode: form.feeMode,
    annual_ctc: round2(form.annualCtc || 0),
    fee_percent: form.feePercent || 0,
    fee_amount: fee,
    gst_applicable: form.gstApplicable,
    gst_percent: form.gstPercent || 0,
    gst_amount: gst,
    total_fee: total,
    tds_applicable: form.tdsApplicable,
    tds_percent: form.tdsPercent || 0,
    tds_on: form.tdsOn,
    tds_amount: tds,
    net_payable: net,
    credit_days: Math.max(0, form.creditDays),
    due_date: addDaysISO(form.joiningDate, Math.max(0, form.creditDays)),
    replacement_days: Math.max(0, form.replacementDays),
    replacement_until:
      form.replacementDays > 0 ? addDaysISO(form.joiningDate, form.replacementDays) : null,
    notes: form.notes.trim(),
    updated_at: new Date().toISOString(),
  };
}

export async function savePlacement(id: string | null, form: PlacementForm): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  if (!form.candidateName.trim()) return { ok: false, error: "Candidate name is required." };
  if (!form.clientId && !form.clientName.trim())
    return { ok: false, error: "Pick or name the client to bill." };
  if (!form.joiningDate) return { ok: false, error: "Date of joining is required." };
  if (form.feeMode === "percent" && !(form.annualCtc > 0))
    return { ok: false, error: "Enter the annual CTC to compute the fee." };
  if (form.feeMode === "flat" && !(form.flatFee > 0))
    return { ok: false, error: "Enter the flat fee amount." };

  const payload = buildPayload(form);

  if (id) {
    const { data: existing } = await sb
      .from("placements")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return { ok: false, error: "Placement not found." };
    const { error } = await sb.from("placements").update(payload).eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    return { ok: true, id, message: "Placement updated" };
  }

  const { data: created, error } = await sb
    .from("placements")
    .insert({ ...payload, created_by: me.id })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message || "Failed to save placement." };
  await sb.from("placement_events").insert({
    placement_id: created.id,
    kind: "created",
    body: `Placement recorded — ${payload.candidate_name} at ${payload.client_name || "client"} (fee ${money(payload.total_fee)})`,
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, id: created.id, message: "Placement recorded" };
}

export async function deletePlacement(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  const { data: p } = await sb
    .from("placements")
    .select("amount_received")
    .eq("id", id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Placement not found." };
  if (p.amount_received > 0)
    return { ok: false, error: "This placement has recorded payments — delete them first." };
  const { error } = await sb.from("placements").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, message: "Placement deleted" };
}

// ---- status ------------------------------------------------------------------

export async function setPlacementStatus(
  id: string,
  status: "replaced" | "cancelled" | "written_off" | "pending",
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  const { data: p } = await sb
    .from("placements")
    .select("candidate_name,amount_received")
    .eq("id", id)
    .maybeSingle();
  if (!p) return { ok: false, error: "Placement not found." };
  const { error } = await sb
    .from("placements")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  const label: Record<string, string> = {
    replaced: "Marked as replacement (candidate left within guarantee)",
    cancelled: "Placement cancelled",
    written_off: "Fee written off",
    pending: "Reopened — awaiting payment",
  };
  await sb.from("placement_events").insert({
    placement_id: id,
    kind: "status",
    body: label[status],
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: `${p.candidate_name}: ${status.replace(/_/g, " ")}` };
}

// ---- payments ----------------------------------------------------------------

export type PlacementPaymentForm = {
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  reference: string;
  notes: string;
};

async function recompute(sb: Awaited<ReturnType<typeof createClient>>, placementId: string) {
  const [{ data: p }, { data: pays }] = await Promise.all([
    sb.from("placements").select("total_fee,net_payable,status").eq("id", placementId).single(),
    sb.from("placement_payments").select("amount").eq("placement_id", placementId),
  ]);
  if (!p) return;
  const received = round2((pays ?? []).reduce((s, x) => s + x.amount, 0));
  // "Paid" means the full NET (post-TDS) cash has been collected.
  const collectible = netPayable(p);
  const patch: Partial<PlacementRow> = {
    amount_received: received,
    updated_at: new Date().toISOString(),
  };
  // Don't override terminal states set by hand.
  if (!["cancelled", "written_off", "replaced"].includes(p.status)) {
    if (received >= collectible - 0.01 && collectible > 0) patch.status = "paid";
    else if (received > 0) patch.status = "partial";
    else patch.status = p.status === "invoiced" ? "invoiced" : "pending";
  }
  await sb.from("placements").update(patch).eq("id", placementId);
}

export async function recordPlacementPayment(
  placementId: string,
  form: PlacementPaymentForm,
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  const amount = round2(Number(form.amount));
  if (!amount || amount <= 0) return { ok: false, error: "Enter a valid payment amount." };
  if (!form.paidOn) return { ok: false, error: "Payment date is required." };
  const { data: p } = await sb
    .from("placements")
    .select("total_fee,net_payable,amount_received,candidate_name,status")
    .eq("id", placementId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Placement not found." };
  if (["cancelled"].includes(p.status))
    return { ok: false, error: "This placement is cancelled." };
  const balance = round2(netPayable(p) - p.amount_received);
  if (amount > balance + 0.01)
    return { ok: false, error: `Amount exceeds the balance due (${money(balance)}).` };

  const { error } = await sb.from("placement_payments").insert({
    placement_id: placementId,
    amount,
    paid_on: form.paidOn,
    method: form.method,
    reference: form.reference.trim(),
    notes: form.notes.trim(),
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  await recompute(sb, placementId);
  await sb.from("placement_events").insert({
    placement_id: placementId,
    kind: "payment",
    body: `Payment of ${money(amount)} received (${form.method.replace(/_/g, " ")})${form.reference ? ` — ref ${form.reference.trim()}` : ""}`,
    by_user_id: me.id,
  });
  refresh();
  const fullyPaid = amount >= balance - 0.01;
  return {
    ok: true,
    message: fullyPaid
      ? `${p.candidate_name}: fully paid 🎉`
      : `Payment recorded — ${money(round2(balance - amount))} still due`,
  };
}

export async function deletePlacementPayment(paymentId: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  const { data: pay } = await sb
    .from("placement_payments")
    .select("placement_id,amount")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return { ok: false, error: "Payment not found." };
  const { error } = await sb.from("placement_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: error.message };
  await recompute(sb, pay.placement_id);
  await sb.from("placement_events").insert({
    placement_id: pay.placement_id,
    kind: "payment",
    body: `Payment of ${money(pay.amount)} removed`,
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, message: "Payment removed" };
}

// ---- generate an invoice from a placement ------------------------------------

export async function invoiceFromPlacement(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can manage placements." };
  const { data: p } = await sb.from("placements").select("*").eq("id", id).maybeSingle();
  if (!p) return { ok: false, error: "Placement not found." };
  const placement = p as PlacementRow;
  if (placement.invoice_id)
    return { ok: false, error: "An invoice was already generated for this placement." };

  const client = placement.client_id
    ? (
        await sb
          .from("clients")
          .select("name,contact_email,address,city")
          .eq("id", placement.client_id)
          .maybeSingle()
      ).data
    : null;

  const description =
    `Recruitment fee — ${placement.candidate_name}` +
    (placement.position ? ` (${placement.position})` : "");
  const details =
    `Date of joining: ${format(new Date(placement.joining_date + "T00:00:00"), "dd MMM yyyy")}` +
    (placement.fee_mode === "percent"
      ? ` · ${placement.fee_percent}% of CTC ${money(placement.annual_ctc)}`
      : "");

  const res = await saveInvoice(null, {
    clientId: placement.client_id,
    billToName: client?.name || placement.client_name,
    billToEmail: client?.contact_email || "",
    billToAddress: [client?.address, client?.city].filter(Boolean).join(", "),
    billToGstin: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    paymentTermsDays: placement.credit_days,
    taxMode: placement.gst_applicable ? "cgst_sgst" : "none",
    gstPercent: placement.gst_percent,
    discountPercent: 0,
    notes: "",
    terms: "",
    items: [{ description, details, qty: 1, rate: placement.fee_amount }],
  });
  if (!res.ok || !res.id) return res;

  await sb
    .from("placements")
    .update({
      invoice_id: res.id,
      status: placement.status === "pending" ? "invoiced" : placement.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  await sb.from("placement_events").insert({
    placement_id: id,
    kind: "invoiced",
    body: "Draft invoice generated from this placement",
    by_user_id: me.id,
  });
  refresh();
  return { ok: true, id: res.id, message: "Invoice draft created — opening it" };
}
