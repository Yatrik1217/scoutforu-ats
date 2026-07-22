import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subMonths, startOfMonth } from "date-fns";
import {
  TrendingUp,
  AlarmClock,
  CircleCheckBig,
  CalendarClock,
  UserCheck,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, moneyShort } from "@/lib/invoice";
import {
  placementBalance,
  placementOverdue,
  placementAgingBucket,
  PLACEMENT_AGING_BUCKETS,
  OPEN_PLACEMENT_STATUSES,
  withinGuarantee,
} from "@/lib/placement";
import { hexA } from "@/lib/domain";
import { PlacementStatusBadge } from "@/components/placement-bits";
import { NewPlacementButton } from "@/components/placement-actions";
import type { PlacementRow, PlacementPaymentRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PlacementsDashboard() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");

  const sb = await createClient();
  const [{ data: plData }, { data: payData }, { data: clientRows }] = await Promise.all([
    sb.from("placements").select("*").order("created_at", { ascending: false }),
    sb.from("placement_payments").select("*").order("paid_on", { ascending: false }),
    sb.from("clients").select("id,name"),
  ]);
  const placements = (plData ?? []) as PlacementRow[];
  const payments = (payData ?? []) as PlacementPaymentRow[];
  const clientName = new Map((clientRows ?? []).map((c) => [c.id, c.name]));

  const now = new Date();
  const in30 = new Date(+now + 30 * 86_400_000);
  const open = placements.filter((p) => OPEN_PLACEMENT_STATUSES.includes(p.status));
  const overdue = open.filter((p) => placementOverdue(p, now));

  const expected = open.reduce((s, p) => s + placementBalance(p), 0);
  const overdueAmt = overdue.reduce((s, p) => s + placementBalance(p), 0);
  const received30 = payments
    .filter((p) => +new Date(p.paid_on) >= +now - 30 * 86_400_000)
    .reduce((s, p) => s + p.amount, 0);
  const dueSoon = open.filter(
    (p) => p.due_date && new Date(p.due_date) >= now && new Date(p.due_date) <= in30,
  );
  const dueSoonAmt = dueSoon.reduce((s, p) => s + placementBalance(p), 0);
  const joined30 = placements.filter(
    (p) => +new Date(p.joining_date) >= +now - 30 * 86_400_000,
  ).length;
  const inGuarantee = placements.filter((p) => withinGuarantee(p, now)).length;

  // monthly: fee booked (by joining date) vs collected (by payment date)
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(now, 5 - i)));
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM");
    const booked = placements
      .filter((p) => p.status !== "cancelled" && p.joining_date.startsWith(key))
      .reduce((s, p) => s + p.total_fee, 0);
    const collected = payments
      .filter((p) => p.paid_on.startsWith(key))
      .reduce((s, p) => s + p.amount, 0);
    return { label: format(m, "MMM"), booked, collected };
  });
  const maxBar = Math.max(1, ...monthly.flatMap((m) => [m.booked, m.collected]));

  // aging
  const aging = PLACEMENT_AGING_BUCKETS.map(() => 0);
  for (const p of open) aging[placementAgingBucket(p, now)] += placementBalance(p);
  const agingMax = Math.max(1, ...aging);
  const AGING_COLORS = ["#16a34a", "#f59e0b", "#e8833a", "#ef4444", "#b91c1c"];

  // top clients by outstanding
  const byClient = new Map<string, number>();
  for (const p of open) {
    const name = p.client_id ? (clientName.get(p.client_id) ?? p.client_name) : p.client_name;
    byClient.set(name || "—", (byClient.get(name || "—") ?? 0) + placementBalance(p));
  }
  const topClients = [...byClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topClientMax = Math.max(1, ...topClients.map(([, v]) => v));

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
    { label: "Expected Revenue", value: moneyShort(expected), sub: `${open.length} open placement${open.length === 1 ? "" : "s"}`, icon: TrendingUp, color: "#2a6fdb", href: "/placements/all?f=open" },
    { label: "Overdue", value: moneyShort(overdueAmt), sub: `${overdue.length} past due`, icon: AlarmClock, color: "#ef4444", href: "/placements/all?f=overdue" },
    { label: "Due in 30 days", value: moneyShort(dueSoonAmt), sub: `${dueSoon.length} payment${dueSoon.length === 1 ? "" : "s"}`, icon: CalendarClock, color: "#8b5cf6", href: "/placements/all?f=open" },
    { label: "Received (30 days)", value: moneyShort(received30), sub: "collected", icon: CircleCheckBig, color: "#16a34a", href: "/placements/all?f=paid" },
    { label: "New Joiners (30d)", value: String(joined30), sub: `${inGuarantee} in guarantee`, icon: UserCheck, color: "#e8833a", href: "/placements/all" },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Placements & Revenue
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Every hire, its fee, and when the client&apos;s payment is due — tracked to the rupee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/placements/all"
            className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            All placements
          </Link>
          <NewPlacementButton />
        </div>
      </div>

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

      <div className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[15.5px] font-extrabold">Fee Booked vs Collected</div>
              <div className="text-[12px] font-medium text-[#8a94a6]">Last 6 months</div>
            </div>
            <div className="flex items-center gap-4 text-[11.5px] font-bold text-[#7a8696]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[3px] bg-[#2a6fdb]" /> Booked
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
                    style={{ height: `${Math.max(2, (m.booked / maxBar) * 100)}%` }}
                    title={`Booked ${money(m.booked)}`}
                  />
                  <div
                    className="w-[26%] max-w-[26px] rounded-t-[5px] bg-[#16a34a]"
                    style={{ height: `${Math.max(2, (m.collected / maxBar) * 100)}%` }}
                    title={`Collected ${money(m.collected)}`}
                  />
                </div>
                <div className="text-[11px] font-bold text-[#8a94a6]">{m.label}</div>
                <div className="tf-num text-[10px] font-semibold text-[#a3acbd]">
                  {m.booked ? moneyShort(m.booked) : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="text-[15.5px] font-extrabold">Payments Aging</div>
          <div className="mb-4 text-[12px] font-medium text-[#8a94a6]">Outstanding by how overdue</div>
          {PLACEMENT_AGING_BUCKETS.map((b, i) => (
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
            Total expected{" "}
            <span className="tf-num float-right font-extrabold text-[#16203a]">{money(expected)}</span>
          </div>
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-[1.55fr_1fr] gap-[18px]">
        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15.5px] font-extrabold">Recent Placements</div>
            <Link
              href="/placements/all"
              className="flex items-center gap-1 rounded-lg bg-[#eef4fe] px-3 py-[7px] text-[12.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
            >
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {placements.slice(0, 7).map((p) => (
            <Link
              key={p.id}
              href={`/placements/${p.id}`}
              className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[10px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{p.candidate_name}</div>
                <div className="truncate text-[11px] font-medium text-[#a3acbd]">
                  {(p.client_id ? clientName.get(p.client_id) : "") || p.client_name || "—"}
                  {" · joined "}
                  {format(new Date(p.joining_date + "T00:00:00"), "dd MMM yy")}
                </div>
              </div>
              <div className="text-right">
                <div className="tf-num text-[13px] font-extrabold">{money(p.total_fee)}</div>
                <div className="text-[10.5px] font-medium text-[#a3acbd]">
                  due {p.due_date ? format(new Date(p.due_date + "T00:00:00"), "dd MMM") : "—"}
                </div>
              </div>
              <PlacementStatusBadge placement={p} />
            </Link>
          ))}
          {placements.length === 0 && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#a3acbd]">
              No placements yet — record your first hire.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
          <div className="text-[15.5px] font-extrabold">Payments Due</div>
          <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">Soonest first</div>
          {upcoming.slice(0, 6).map((p) => {
            const od = placementOverdue(p, now);
            return (
              <Link
                key={p.id}
                href={`/placements/${p.id}`}
                className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-[9px] last:border-0 hover:bg-[#f6f8fb]"
              >
                <div
                  className={`w-[52px] shrink-0 text-center text-[11px] font-extrabold ${od ? "text-[#dc2626]" : "text-[#2a6fdb]"}`}
                >
                  {p.due_date ? format(new Date(p.due_date + "T00:00:00"), "dd MMM") : "—"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-bold">{p.candidate_name}</div>
                  <div className="truncate text-[10.5px] font-medium text-[#a3acbd]">
                    {(p.client_id ? clientName.get(p.client_id) : "") || p.client_name}
                  </div>
                </div>
                <div className={`tf-num text-[12.5px] font-extrabold ${od ? "text-[#dc2626]" : ""}`}>
                  {money(placementBalance(p))}
                </div>
              </Link>
            );
          })}
          {upcoming.length === 0 && (
            <div className="py-8 text-center text-[13px] font-semibold text-[#a3acbd]">
              Nothing outstanding 🎉
            </div>
          )}

          {topClients.length > 0 && (
            <>
              <div className="mb-2 mt-5 flex items-center gap-1.5 text-[13px] font-extrabold">
                <ShieldCheck size={14} className="text-[#8b5cf6]" /> Top clients by outstanding
              </div>
              {topClients.map(([name, amt]) => (
                <div key={name} className="mb-2 flex items-center gap-2.5">
                  <div className="w-[96px] shrink-0 truncate text-[11.5px] font-semibold text-[#42506b]">
                    {name}
                  </div>
                  <div className="h-[16px] flex-1 overflow-hidden rounded-[5px] bg-[#f1f4f9]">
                    <div
                      className="h-full rounded-[5px] bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa]"
                      style={{ width: `${Math.max(6, (amt / topClientMax) * 100)}%` }}
                    />
                  </div>
                  <div className="tf-num w-[64px] shrink-0 text-right text-[11.5px] font-extrabold">
                    {moneyShort(amt)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
