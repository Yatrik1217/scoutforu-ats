import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import {
  IndianRupee,
  FileText,
  UserCheck,
  ShieldCheck,
  RefreshCcw,
  StickyNote,
  CalendarClock,
} from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, METHOD_LABEL } from "@/lib/invoice";
import {
  placementBalance,
  placementOverdue,
  daysUntilDue,
  withinGuarantee,
} from "@/lib/placement";
import { PlacementStatusBadge } from "@/components/placement-bits";
import { PlacementActions, DeletePlacementPaymentButton } from "@/components/placement-actions";
import type {
  PlacementRow,
  PlacementPaymentRow,
  PlacementEventRow,
  ProfileRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtD = (d: string | null) => (d ? format(new Date(d + "T00:00:00"), "dd MMM yyyy") : "—");

const EVENT_ICON: Record<string, typeof FileText> = {
  created: UserCheck,
  invoiced: FileText,
  payment: IndianRupee,
  status: RefreshCcw,
  note: StickyNote,
};

export default async function PlacementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const sb = await createClient();
  const [{ data: plData }, { data: payData }, { data: eventData }, { data: clientRows }, { data: team }] =
    await Promise.all([
      sb.from("placements").select("*").eq("id", id).maybeSingle(),
      sb.from("placement_payments").select("*").eq("placement_id", id).order("paid_on", { ascending: false }),
      sb.from("placement_events").select("*").eq("placement_id", id).order("created_at", { ascending: false }),
      sb.from("clients").select("id,name"),
      sb.from("profiles").select("id,name"),
    ]);
  if (!plData) notFound();
  const p = plData as PlacementRow;
  const payments = (payData ?? []) as PlacementPaymentRow[];
  const events = (eventData ?? []) as PlacementEventRow[];
  const clientName = new Map((clientRows ?? []).map((c) => [c.id, c.name]));
  const nameById = new Map((team ?? []).map((t: Pick<ProfileRow, "id" | "name">) => [t.id, t.name]));

  const client = (p.client_id ? clientName.get(p.client_id) : "") || p.client_name || "—";
  const od = placementOverdue(p);
  const dd = daysUntilDue(p);
  const balance = placementBalance(p);
  const guarantee = withinGuarantee(p);

  const facts: { label: string; value: string; icon: typeof IndianRupee; color: string }[] = [
    { label: "Total fee", value: money(p.total_fee), icon: IndianRupee, color: "#2a6fdb" },
    { label: "Received", value: money(p.amount_received), icon: IndianRupee, color: "#16a34a" },
    { label: "Balance due", value: money(balance), icon: IndianRupee, color: od ? "#dc2626" : "#e8833a" },
    {
      label: "Payment due",
      value: fmtD(p.due_date),
      icon: CalendarClock,
      color: od ? "#dc2626" : "#8b5cf6",
    },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
              {p.candidate_name}
            </h1>
            <PlacementStatusBadge placement={p} />
            {od && (
              <span className="text-[12px] font-bold text-[#dc2626]">{-dd} days overdue</span>
            )}
            {guarantee && (
              <span className="flex items-center gap-1 rounded-full bg-[#fef3c7] px-2.5 py-1 text-[11px] font-bold text-[#b45309]">
                <ShieldCheck size={12} /> In guarantee till {fmtD(p.replacement_until)}
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#8a94a6]">
            {p.position ? `${p.position} · ` : ""}
            {client} · joined {fmtD(p.joining_date)}
          </p>
        </div>
        <Link href="/placements/all" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
          ← All placements
        </Link>
      </div>

      <PlacementActions placement={p} />

      {/* fact cards */}
      <div className="mt-[18px] grid grid-cols-4 gap-4">
        {facts.map((fct) => {
          const Icon = fct.icon;
          return (
            <div key={fct.label} className="rounded-2xl border border-[#e9edf3] bg-white p-[16px]">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#8a94a6]">
                <Icon size={13} style={{ color: fct.color }} /> {fct.label}
              </div>
              <div className="tf-num mt-1.5 text-[19px] font-extrabold" style={{ color: fct.color }}>
                {fct.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-[18px] grid grid-cols-[1.5fr_1fr] items-start gap-[18px]">
        {/* details */}
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="text-[15px] font-extrabold">Placement details</div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
            <Detail label="Candidate" value={p.candidate_name} />
            <Detail label="Position" value={p.position || "—"} />
            <Detail label="Client" value={client} />
            <Detail label="Recruiter" value={(p.recruiter_id && nameById.get(p.recruiter_id)) || "—"} />
            <Detail label="Date of joining" value={fmtD(p.joining_date)} />
            <Detail
              label="Payment terms"
              value={p.credit_days === 0 ? "On joining" : `${p.credit_days} days from DOJ`}
            />
            <Detail
              label="Fee basis"
              value={
                p.fee_mode === "percent"
                  ? `${p.fee_percent}% of ${money(p.annual_ctc)} CTC`
                  : "Flat fee"
              }
            />
            <Detail
              label="Guarantee"
              value={p.replacement_days ? `${p.replacement_days} days (till ${fmtD(p.replacement_until)})` : "None"}
            />
          </div>

          <div className="mt-5 border-t border-[#f0f3f8] pt-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-[#7a8696]">Base fee</span>
              <span className="tf-num font-bold">{money(p.fee_amount)}</span>
            </div>
            {p.gst_applicable && (
              <div className="mt-1.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[#7a8696]">GST ({p.gst_percent}%)</span>
                <span className="tf-num font-bold">{money(p.gst_amount)}</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between rounded-[8px] bg-[#eef4fe] px-3 py-2">
              <span className="font-extrabold text-[#16203a]">Total receivable</span>
              <span className="tf-num text-[15px] font-extrabold text-[#2a6fdb]">
                {money(p.total_fee)}
              </span>
            </div>
          </div>

          {p.notes && (
            <div className="mt-4">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">Notes</div>
              <div className="mt-1 whitespace-pre-line text-[12.5px] text-[#42506b]">{p.notes}</div>
            </div>
          )}

          {p.invoice_id && (
            <Link
              href={`/invoices/${p.invoice_id}`}
              className="mt-4 flex items-center gap-2 rounded-[10px] bg-[#f3eefe] px-4 py-2.5 text-[12.5px] font-bold text-[#8b5cf6] hover:bg-[#ece3fd]"
            >
              <FileText size={14} /> An invoice was generated from this placement — open it →
            </Link>
          )}
        </div>

        {/* payments + activity */}
        <div className="space-y-[18px]">
          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[14px] font-extrabold">Payments</div>
              <span className="tf-num rounded-full bg-[#e9f9ef] px-2.5 py-[3px] text-[11.5px] font-bold text-[#16a34a]">
                {money(p.amount_received)} received
              </span>
            </div>
            {payments.map((pay) => (
              <div
                key={pay.id}
                className="flex items-center gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0"
              >
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#e9f9ef] text-[#16a34a]">
                  <IndianRupee size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="tf-num text-[13px] font-extrabold">{money(pay.amount)}</div>
                  <div className="truncate text-[11px] text-[#8a94a6]">
                    {fmtD(pay.paid_on)} · {METHOD_LABEL[pay.method]}
                    {pay.reference ? ` · ${pay.reference}` : ""}
                  </div>
                </div>
                <DeletePlacementPaymentButton paymentId={pay.id} />
              </div>
            ))}
            {payments.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                No payments recorded yet.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-3 text-[14px] font-extrabold">Activity</div>
            {events.map((e) => {
              const Icon = EVENT_ICON[e.kind] ?? StickyNote;
              return (
                <div key={e.id} className="flex gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0">
                  <div className="mt-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#eef4fe] text-[#2a6fdb]">
                    <Icon size={12} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-snug text-[#42506b]">{e.body}</div>
                    <div className="mt-0.5 text-[10.5px] font-medium text-[#a3acbd]">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      {e.by_user_id && nameById.get(e.by_user_id) ? ` · ${nameById.get(e.by_user_id)}` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            {events.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                No activity yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-[#a3acbd]">{label}</div>
      <div className="mt-0.5 font-semibold text-[#16203a]">{value}</div>
    </div>
  );
}
