import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subMonths, startOfMonth } from "date-fns";
import {
  Wallet,
  AlarmClock,
  CircleCheckBig,
  FileClock,
  CalendarClock,
  Repeat,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generateDueRecurring } from "@/lib/actions/invoices";
import {
  money,
  moneyShort,
  balanceDue,
  isOverdue,
  agingBucket,
  AGING_BUCKETS,
  OPEN_STATUSES,
  FREQ_LABEL,
  computeTotals,
} from "@/lib/invoice";
import { hexA } from "@/lib/domain";
import { InvoiceStatusBadge } from "@/components/invoice-bits";
import { NewInvoiceButton } from "@/components/invoice-actions";
import type { InvoiceRow, InvoicePaymentRow, InvoiceRecurringRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function InvoicesDashboard() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");

  // Lazy scheduler: draft any recurring invoices that have come due.
  const generated = await generateDueRecurring();

  const sb = await createClient();
  const [{ data: invData }, { data: payData }, { data: recData }] = await Promise.all([
    sb.from("invoices").select("*").order("created_at", { ascending: false }),
    sb.from("invoice_payments").select("*").order("paid_on", { ascending: false }),
    sb.from("invoice_recurring").select("*").eq("active", true).order("next_date"),
  ]);
  const invoices = (invData ?? []) as InvoiceRow[];
  const payments = (payData ?? []) as InvoicePaymentRow[];
  const recurring = (recData ?? []) as InvoiceRecurringRow[];

  const now = new Date();
  const in30 = new Date(+now + 30 * 86_400_000);
  const open = invoices.filter((i) => OPEN_STATUSES.includes(i.status));
  const overdue = open.filter((i) => isOverdue(i, now));
  const drafts = invoices.filter((i) => i.status === "draft");

  const outstanding = open.reduce((s, i) => s + balanceDue(i), 0);
  const overdueAmt = overdue.reduce((s, i) => s + balanceDue(i), 0);
  const draftAmt = drafts.reduce((s, i) => s + i.total, 0);
  const paid30 = payments
    .filter((p) => +new Date(p.paid_on) >= +now - 30 * 86_400_000)
    .reduce((s, p) => s + p.amount, 0);

  // Expected inflow (next 30 days): open invoices due in window + recurring drafts due.
  const dueSoon = open.filter(
    (i) => i.due_date && new Date(i.due_date) >= now && new Date(i.due_date) <= in30,
  );
  const recurringSoon = recurring.filter((r) => new Date(r.next_date) <= in30);
  const expected30 =
    dueSoon.reduce((s, i) => s + balanceDue(i), 0) +
    recurringSoon.reduce(
      (s, r) => s + computeTotals(r.items, r.discount_percent, r.gst_percent, r.tax_mode).total,
      0,
    );

  // Monthly invoiced vs collected — last 6 months.
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i)));
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM");
    const invoiced = invoices
      .filter((i) => !["draft", "void"].includes(i.status) && i.issue_date.startsWith(key))
      .reduce((s, i) => s + i.total, 0);
    const collected = payments
      .filter((p) => p.paid_on.startsWith(key))
      .reduce((s, p) => s + p.amount, 0);
    return { label: format(m, "MMM"), invoiced, collected };
  });
  const maxBar = Math.max(1, ...monthly.flatMap((m) => [m.invoiced, m.collected]));

  // Receivables aging.
  const aging = AGING_BUCKETS.map(() => 0);
  for (const i of open) aging[agingBucket(i)] += balanceDue(i);
  const agingMax = Math.max(1, ...aging);
  const AGING_COLORS = ["#16a34a", "#f59e0b", "#e8833a", "#ef4444", "#b91c1c"];

  // Upcoming expected payments (open, soonest due first).
  const upcoming = [...open].sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );

  const stats: {
    label: string;
    value: string;
    sub: string;
    icon: LucideIcon;
    color: string;
    href: string;
  }[] = [
    { label: "Total Outstanding", value: moneyShort(outstanding), sub: `${open.length} unpaid invoice${open.length === 1 ? "" : "s"}`, icon: Wallet, color: "#2a6fdb", href: "/invoices/all?f=unpaid" },
    { label: "Overdue", value: moneyShort(overdueAmt), sub: `${overdue.length} invoice${overdue.length === 1 ? "" : "s"} past due`, icon: AlarmClock, color: "#ef4444", href: "/invoices/all?f=overdue" },
    { label: "Collected (30 days)", value: moneyShort(paid30), sub: "payments received", icon: CircleCheckBig, color: "#16a34a", href: "/invoices/all?f=paid" },
    { label: "Expected (30 days)", value: moneyShort(expected30), sub: `incl. ${recurringSoon.length} recurring`, icon: CalendarClock, color: "#8b5cf6", href: "/invoices/all?f=unpaid" },
    { label: "Drafts", value: moneyShort(draftAmt), sub: `${drafts.length} draft${drafts.length === 1 ? "" : "s"} to send`, icon: FileClock, color: "#e8833a", href: "/invoices/all?f=draft" },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Invoices
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Receivables at a glance — prepare, send and track every payment.
            {generated > 0 && (
              <span className="ml-2 font-bold text-[#8b5cf6]">
                {generated} recurring draft{generated > 1 ? "s" : ""} just generated ✨
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices/recurring"
            className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            <Repeat size={14} /> Recurring
          </Link>
          <Link
            href="/invoices/all"
            className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            All invoices
          </Link>
          <NewInvoiceButton />
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-[#e9edf3] bg-white p-[18px] transition hover:border-[#cbd7ea] hover:shadow-[0_6px_20px_rgba(20,32,58,.08)]"
            >
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
                style={{ background: hexA(s.color, 0.12), color: s.color }}
              >
                <Icon size={18} />
              </div>
              <div className="font-display tf-num mt-3.5 text-[24px] font-extrabold tracking-tight">
                {s.value}
              </div>
              <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">{s.label}</div>
              <div className="text-[11px] font-medium text-[#a3acbd]">{s.sub}</div>
            </Link>
          );
        })}
      </div>

      {/* chart + aging */}
      <div className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[15.5px] font-extrabold">Invoiced vs Collected</div>
              <div className="text-[12px] font-medium text-[#8a94a6]">Last 6 months</div>
            </div>
            <div className="flex items-center gap-4 text-[11.5px] font-bold text-[#7a8696]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#2a6fdb]" /> Invoiced
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#16a34a]" /> Collected
              </span>
            </div>
          </div>
          <div className="flex h-[190px] items-end gap-4 border-b border-[#eef1f6] pb-px">
            {monthly.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-[150px] w-full items-end justify-center gap-1.5">
                  <div
                    className="w-[26%] max-w-[26px] rounded-t-[5px] bg-[#2a6fdb]"
                    style={{ height: `${Math.max(2, (m.invoiced / maxBar) * 100)}%` }}
                    title={`Invoiced ${money(m.invoiced)}`}
                  />
                  <div
                    className="w-[26%] max-w-[26px] rounded-t-[5px] bg-[#16a34a]"
                    style={{ height: `${Math.max(2, (m.collected / maxBar) * 100)}%` }}
                    title={`Collected ${money(m.collected)}`}
                  />
                </div>
                <div className="text-[11px] font-bold text-[#8a94a6]">{m.label}</div>
                <div className="tf-num text-[10px] font-semibold text-[#a3acbd]">
                  {m.invoiced ? moneyShort(m.invoiced) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="text-[15.5px] font-extrabold">Receivables Aging</div>
          <div className="mb-4 text-[12px] font-medium text-[#8a94a6]">
            Outstanding by how overdue it is
          </div>
          {AGING_BUCKETS.map((b, i) => (
            <div key={b} className="mb-[10px] flex items-center gap-3">
              <div className="w-[74px] shrink-0 text-right text-[12px] font-semibold text-[#42506b]">
                {b}
              </div>
              <div className="h-[22px] flex-1 overflow-hidden rounded-[6px] bg-[#f1f4f9]">
                <div
                  className="h-full rounded-[6px]"
                  style={{
                    width: `${Math.max(aging[i] > 0 ? 6 : 0, (aging[i] / agingMax) * 100)}%`,
                    background: AGING_COLORS[i],
                  }}
                />
              </div>
              <div className="tf-num w-[70px] shrink-0 text-right text-[12px] font-extrabold">
                {aging[i] ? moneyShort(aging[i]) : "—"}
              </div>
            </div>
          ))}
          <div className="mt-4 rounded-[10px] bg-[#f8fafc] px-4 py-3 text-[12px] font-semibold text-[#7a8696]">
            Total receivable{" "}
            <span className="tf-num float-right font-extrabold text-[#16203a]">
              {money(outstanding)}
            </span>
          </div>
        </div>
      </div>

      {/* recent + upcoming */}
      <div className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15.5px] font-extrabold">Recent Invoices</div>
            <Link
              href="/invoices/all"
              className="flex items-center gap-1 rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {invoices.slice(0, 8).map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[10px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="w-[86px] shrink-0 text-[12.5px] font-extrabold text-[#2a6fdb]">
                {inv.invoice_no}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{inv.bill_to_name || "—"}</div>
                <div className="text-[11px] font-medium text-[#a3acbd]">
                  Issued {format(new Date(inv.issue_date + "T00:00:00"), "dd MMM")} · Due{" "}
                  {inv.due_date ? format(new Date(inv.due_date + "T00:00:00"), "dd MMM") : "—"}
                </div>
              </div>
              <div className="tf-num text-[13px] font-extrabold">{money(inv.total)}</div>
              <InvoiceStatusBadge invoice={inv} />
            </Link>
          ))}
          {invoices.length === 0 && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#a3acbd]">
              No invoices yet — create your first one.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="text-[15.5px] font-extrabold">Expected Payments</div>
          <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">
            Due dates on unpaid invoices & upcoming recurring
          </div>
          {upcoming.slice(0, 5).map((inv) => {
            const od = isOverdue(inv, now);
            return (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[9px] last:border-0 hover:bg-[#f6f8fb]"
              >
                <div
                  className={`w-[52px] shrink-0 text-center text-[11px] font-extrabold ${od ? "text-[#dc2626]" : "text-[#2a6fdb]"}`}
                >
                  {inv.due_date ? format(new Date(inv.due_date + "T00:00:00"), "dd MMM") : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold">{inv.bill_to_name}</div>
                  <div className="text-[10.5px] font-medium text-[#a3acbd]">{inv.invoice_no}</div>
                </div>
                <div className={`tf-num text-[12.5px] font-extrabold ${od ? "text-[#dc2626]" : ""}`}>
                  {money(balanceDue(inv))}
                </div>
              </Link>
            );
          })}
          {recurringSoon.slice(0, 3).map((r) => (
            <Link
              key={r.id}
              href="/invoices/recurring"
              className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[9px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="w-[52px] shrink-0 text-center text-[11px] font-extrabold text-[#8b5cf6]">
                {format(new Date(r.next_date + "T00:00:00"), "dd MMM")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-bold">{r.name}</div>
                <div className="text-[10.5px] font-medium text-[#8b5cf6]">
                  Recurring · {FREQ_LABEL[r.frequency]}
                </div>
              </div>
              <div className="tf-num text-[12.5px] font-extrabold">
                {money(computeTotals(r.items, r.discount_percent, r.gst_percent, r.tax_mode).total)}
              </div>
            </Link>
          ))}
          {upcoming.length === 0 && recurringSoon.length === 0 && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#a3acbd]">
              Nothing pending — all caught up 🎉
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
