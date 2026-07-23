import Link from "next/link";
import { redirect } from "next/navigation";
import { format, subMonths, startOfMonth } from "date-fns";
import {
  Trophy,
  TrendingUp,
  CircleCheckBig,
  Wallet,
  HandCoins,
  Settings2,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, moneyShort } from "@/lib/invoice";
import { placementBalance } from "@/lib/placement";
import {
  PERIODS,
  periodRange,
  inRange,
  buildRecruiterStats,
  buildClosureStatement,
  feeShareOfPayment,
  fyStartYear,
  fyLabel,
  type PeriodKey,
} from "@/lib/incentive";
import { hexA } from "@/lib/domain";
import { Avatar } from "@/components/bits";
import type {
  PlacementRow,
  PlacementPaymentRow,
  IncentiveSettingsRow,
  ProfileRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { p = "this_fy" } = await searchParams;
  const periodKey = (PERIODS.find((x) => x.key === p)?.key ?? "this_fy") as PeriodKey;
  const range = periodRange(periodKey);

  const sb = await createClient();
  const [{ data: plData }, { data: payData }, { data: team }, { data: settingsData }] =
    await Promise.all([
      sb.from("placements").select("*"),
      sb.from("placement_payments").select("*"),
      sb
        .from("profiles")
        .select("id,name,color,active,role,incentive_percent")
        .neq("role", "client")
        .order("name"),
      sb.from("incentive_settings").select("*").maybeSingle(),
    ]);

  const placements = (plData ?? []) as PlacementRow[];
  const payments = (payData ?? []) as PlacementPaymentRow[];
  const settings = (settingsData as IncentiveSettingsRow) ?? null;
  const recruiters = (team ?? []) as Pick<
    ProfileRow,
    "id" | "name" | "color" | "active" | "incentive_percent"
  >[];

  const stats = buildRecruiterStats({
    recruiters,
    placements,
    payments,
    range,
    settings,
    balanceOf: placementBalance,
  });

  // In closure-tier mode the incentive is a financial-year figure, not a
  // period one — compute each recruiter's FY statement and use that instead.
  const closureMode = settings?.mode === "closure";
  const fyYear = fyStartYear(new Date());
  const closureTotals = new Map<string, { total: number; closures: number }>();
  if (closureMode && settings) {
    for (const r of recruiters) {
      const st = buildClosureStatement({
        placements: placements.filter((x) => x.recruiter_id === r.id),
        settings,
        startYear: fyYear,
      });
      closureTotals.set(r.id, { total: st.total, closures: st.annual.eligible });
    }
  }
  const incentiveOf = (id: string) =>
    closureMode ? (closureTotals.get(id)?.total ?? 0) : (stats.find((s) => s.id === id)?.incentive ?? 0);

  // Firm totals for the period.
  const periodPlacements = placements.filter(
    (x) => x.status !== "cancelled" && inRange(x.joining_date, range),
  );
  const byId = new Map(placements.map((x) => [x.id, x]));
  const periodPayments = payments.filter((pay) => inRange(pay.paid_on, range));
  const totalBooked = periodPlacements.reduce((s, x) => s + x.fee_amount, 0);
  const totalCollected = periodPayments.reduce((s, pay) => s + pay.amount, 0);
  const totalCollectedFee = periodPayments.reduce((s, pay) => {
    const pl = byId.get(pay.placement_id);
    return pl ? s + feeShareOfPayment(pay.amount, pl) : s;
  }, 0);
  const totalIncentive = closureMode
    ? [...closureTotals.values()].reduce((s, x) => s + x.total, 0)
    : stats.reduce((s, x) => s + x.incentive, 0);
  const totalOutstanding = placements
    .filter((x) => x.status !== "cancelled")
    .reduce((s, x) => s + placementBalance(x), 0);

  const basisLabel = settings?.basis === "booked" ? "fee booked" : "money collected";
  const maxBar = Math.max(1, ...stats.map((s) => s.basisAmount));

  // 6-month firm trend (base fee booked vs fee collected).
  const months = Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
  const monthly = months.map((m) => {
    const key = format(m, "yyyy-MM");
    const booked = placements
      .filter((x) => x.status !== "cancelled" && x.joining_date.startsWith(key))
      .reduce((s, x) => s + x.fee_amount, 0);
    const collected = payments
      .filter((pay) => pay.paid_on.startsWith(key))
      .reduce((s, pay) => {
        const pl = byId.get(pay.placement_id);
        return pl ? s + feeShareOfPayment(pay.amount, pl) : s;
      }, 0);
    return { label: format(m, "MMM"), booked, collected };
  });
  const maxMonth = Math.max(1, ...monthly.flatMap((m) => [m.booked, m.collected]));

  const cards: {
    label: string;
    value: string;
    sub: string;
    icon: LucideIcon;
    color: string;
  }[] = [
    { label: "Fee Booked", value: moneyShort(totalBooked), sub: `${periodPlacements.length} placement${periodPlacements.length === 1 ? "" : "s"}`, icon: TrendingUp, color: "#2a6fdb" },
    { label: "Collected", value: moneyShort(totalCollected), sub: `${moneyShort(totalCollectedFee)} is fee`, icon: CircleCheckBig, color: "#16a34a" },
    { label: "Outstanding", value: moneyShort(totalOutstanding), sub: "across all placements", icon: Wallet, color: "#e8833a" },
    {
      label: "Incentive Payable",
      value: moneyShort(totalIncentive),
      sub: closureMode ? `closure plan · ${fyLabel(fyYear)}` : `on ${basisLabel}`,
      icon: HandCoins,
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Recruiter Performance
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Who billed what, what came in, and the incentive each recruiter has earned ·{" "}
            <span className="font-bold text-[#42506b]">{range.label}</span>
          </p>
        </div>
        <Link
          href="/admin/settings/incentives"
          className="flex items-center gap-2 rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
        >
          <Settings2 size={14} /> Incentive scheme
        </Link>
      </div>

      {/* period tabs */}
      <div className="mb-4 flex flex-wrap gap-1 rounded-[11px] bg-[#e6eaf1] p-1">
        {PERIODS.map((t) => (
          <Link
            key={t.key}
            href={`/performance?p=${t.key}`}
            className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition ${
              periodKey === t.key
                ? "bg-white text-[#16203a] shadow-sm"
                : "text-[#68758c] hover:text-[#42506b]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-[#e9edf3] bg-white p-[18px]">
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl"
                style={{ background: hexA(c.color, 0.12), color: c.color }}
              >
                <Icon size={18} />
              </div>
              <div className="font-display tf-num mt-3.5 text-[24px] font-extrabold tracking-tight">
                {c.value}
              </div>
              <div className="mt-px text-[12.5px] font-semibold text-[#7a8696]">{c.label}</div>
              <div className="text-[11px] font-medium text-[#a3acbd]">{c.sub}</div>
            </div>
          );
        })}
      </div>

      {/* leaderboard */}
      <div className="mt-[18px] overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#f59e0b]" />
            <span className="text-[15px] font-extrabold">Leaderboard</span>
          </div>
          <span className="text-[11.5px] font-semibold text-[#8a94a6]">
            {closureMode
              ? `Ranked by ${basisLabel} · incentive = closure plan, ${fyLabel(fyYear)} to date`
              : `Ranked by ${basisLabel} · incentive on base fee (excl GST)`}
          </span>
        </div>
        <div className="grid grid-cols-[1.5fr_80px_130px_130px_130px_150px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Recruiter</div>
          <div className="text-center">Hires</div>
          <div className="text-right">Fee booked</div>
          <div className="text-right">Collected</div>
          <div className="text-right">Outstanding</div>
          <div className="text-right">Incentive</div>
        </div>
        {stats.map((s, i) => (
          <Link
            key={s.id}
            href={`/performance/${s.id}?p=${periodKey}`}
            className="grid grid-cols-[1.5fr_80px_130px_130px_130px_150px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-[13px] last:border-0 hover:bg-[#f6f8fb]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`tf-num w-[18px] shrink-0 text-[12px] font-extrabold ${
                  i === 0 ? "text-[#f59e0b]" : "text-[#c2cad8]"
                }`}
              >
                {i + 1}
              </span>
              <Avatar name={s.name} size={32} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-[#16203a]">{s.name}</div>
                <div className="h-[5px] w-[120px] overflow-hidden rounded-full bg-[#f1f4f9]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(s.basisAmount > 0 ? 5 : 0, (s.basisAmount / maxBar) * 100)}%`,
                      background: s.color || "#2a6fdb",
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="tf-num text-center text-[14px] font-extrabold">{s.placements}</div>
            <div className="tf-num text-right text-[13px] font-bold">{money(s.bookedFee)}</div>
            <div className="tf-num text-right text-[13px] font-bold text-[#16a34a]">
              {money(s.collectedCash)}
            </div>
            <div className="tf-num text-right text-[13px] font-semibold text-[#7a8696]">
              {money(s.outstanding)}
            </div>
            <div className="text-right">
              <div className="tf-num text-[14px] font-extrabold text-[#8b5cf6]">
                {money(incentiveOf(s.id))}
              </div>
              <div className="text-[10.5px] font-semibold text-[#a3acbd]">
                {closureMode
                  ? `${closureTotals.get(s.id)?.closures ?? 0} qualifying · FY`
                  : `@ ${s.incentiveRate}%${s.incentivePercent != null ? " (override)" : ""}`}
              </div>
            </div>
          </Link>
        ))}
        {stats.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No recruiters found.
          </div>
        )}
      </div>

      {/* trend */}
      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[15.5px] font-extrabold">Fee Booked vs Fee Collected</div>
            <div className="text-[12px] font-medium text-[#8a94a6]">
              Base fee only, last 6 months
            </div>
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
        <div className="flex h-[180px] items-end gap-4 border-b border-[#eef1f6] pb-px">
          {monthly.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[140px] w-full items-end justify-center gap-1.5">
                <div
                  className="w-[26%] max-w-[26px] rounded-t-[5px] bg-[#2a6fdb]"
                  style={{ height: `${Math.max(2, (m.booked / maxMonth) * 100)}%` }}
                  title={`Booked ${money(m.booked)}`}
                />
                <div
                  className="w-[26%] max-w-[26px] rounded-t-[5px] bg-[#16a34a]"
                  style={{ height: `${Math.max(2, (m.collected / maxMonth) * 100)}%` }}
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

      <div className="mt-3 flex items-center justify-between rounded-[12px] bg-[#f8fafc] px-4 py-3 text-[12px] text-[#7a8696]">
        <span>
          Incentive is calculated on the <b className="text-[#16203a]">base fee</b> (excl GST,
          before TDS), paid on <b className="text-[#16203a]">{basisLabel}</b>.
        </span>
        <Link
          href="/admin/settings/incentives"
          className="flex shrink-0 items-center gap-1 font-bold text-[#2a6fdb] hover:underline"
        >
          Change scheme <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
