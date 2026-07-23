import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { TrendingUp, CircleCheckBig, Wallet, HandCoins, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money, moneyShort } from "@/lib/invoice";
import { placementBalance, placementOverdue } from "@/lib/placement";
import {
  PERIODS,
  periodRange,
  inRange,
  buildRecruiterStats,
  type PeriodKey,
} from "@/lib/incentive";
import { hexA } from "@/lib/domain";
import { Avatar } from "@/components/bits";
import { PlacementStatusBadge } from "@/components/placement-bits";
import type {
  PlacementRow,
  PlacementPaymentRow,
  IncentiveSettingsRow,
  ProfileRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function RecruiterPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { id } = await params;
  const { p = "this_fy" } = await searchParams;
  const periodKey = (PERIODS.find((x) => x.key === p)?.key ?? "this_fy") as PeriodKey;
  const range = periodRange(periodKey);

  const sb = await createClient();
  const [
    { data: profile },
    { data: plData },
    { data: payData },
    { data: settingsData },
    { data: clientRows },
    { data: candCount },
  ] = await Promise.all([
    sb
      .from("profiles")
      .select("id,name,email,color,active,role,incentive_percent")
      .eq("id", id)
      .maybeSingle(),
    sb.from("placements").select("*").eq("recruiter_id", id),
    sb.from("placement_payments").select("*"),
    sb.from("incentive_settings").select("*").maybeSingle(),
    sb.from("clients").select("id,name"),
    sb.from("candidates").select("id,created_at").eq("recruiter_id", id),
  ]);
  if (!profile) notFound();

  const placements = (plData ?? []) as PlacementRow[];
  const settings = (settingsData as IncentiveSettingsRow) ?? null;
  const clientName = new Map((clientRows ?? []).map((c) => [c.id, c.name]));
  const mineIds = new Set(placements.map((x) => x.id));
  const payments = ((payData ?? []) as PlacementPaymentRow[]).filter((x) =>
    mineIds.has(x.placement_id),
  );

  const [stats] = buildRecruiterStats({
    recruiters: [
      profile as Pick<ProfileRow, "id" | "name" | "color" | "active" | "incentive_percent">,
    ],
    placements,
    payments,
    range,
    settings,
    balanceOf: placementBalance,
  });

  const inPeriod = placements
    .filter((x) => x.status !== "cancelled" && inRange(x.joining_date, range))
    .sort((a, b) => b.joining_date.localeCompare(a.joining_date));
  const periodPayments = payments
    .filter((x) => inRange(x.paid_on, range))
    .sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  const candidatesAdded = (candCount ?? []).filter((c) =>
    inRange((c.created_at ?? "").slice(0, 10), range),
  ).length;
  const openPlacements = placements.filter(
    (x) => !["cancelled", "paid", "written_off"].includes(x.status),
  );

  const basisLabel = settings?.basis === "booked" ? "fee booked" : "money collected";

  const cards: { label: string; value: string; sub: string; icon: LucideIcon; color: string }[] = [
    { label: "Fee Booked", value: moneyShort(stats.bookedFee), sub: `${stats.placements} hire${stats.placements === 1 ? "" : "s"}`, icon: TrendingUp, color: "#2a6fdb" },
    { label: "Collected", value: moneyShort(stats.collectedCash), sub: `${moneyShort(stats.collectedFee)} is fee`, icon: CircleCheckBig, color: "#16a34a" },
    { label: "Outstanding", value: moneyShort(stats.outstanding), sub: `${openPlacements.length} open`, icon: Wallet, color: "#e8833a" },
    { label: "Incentive", value: money(stats.incentive), sub: `@ ${stats.incentiveRate}% on ${basisLabel}`, icon: HandCoins, color: "#8b5cf6" },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <Avatar name={profile.name} size={46} />
          <div>
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
              {profile.name}
            </h1>
            <p className="text-[13px] text-[#8a94a6]">
              {profile.email} · <span className="font-bold text-[#42506b]">{range.label}</span>
              {profile.incentive_percent != null && (
                <span className="ml-2 rounded-full bg-[#f3eefe] px-2 py-0.5 text-[11px] font-bold text-[#8b5cf6]">
                  {profile.incentive_percent}% override
                </span>
              )}
            </p>
          </div>
        </div>
        <Link
          href={`/performance?p=${periodKey}`}
          className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline"
        >
          ← Leaderboard
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-[11px] bg-[#e6eaf1] p-1">
        {PERIODS.map((t) => (
          <Link
            key={t.key}
            href={`/performance/${id}?p=${t.key}`}
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

      {/* incentive working */}
      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="text-[15px] font-extrabold">Incentive working</div>
        <div className="mt-3 max-w-[520px] space-y-1.5 text-[13px]">
          <Row
            label={
              settings?.basis === "booked"
                ? "Base fee booked in period"
                : "Base-fee share of payments received"
            }
            value={money(stats.basisAmount)}
          />
          <Row
            label={`Rate${stats.incentivePercent != null ? " (personal override)" : settings?.mode === "slab" ? " (slab)" : ""}`}
            value={`${stats.incentiveRate}%`}
          />
          <div className="flex items-center justify-between rounded-[8px] bg-[#f3eefe] px-3 py-2">
            <span className="font-extrabold text-[#16203a]">Incentive earned</span>
            <span className="tf-num text-[15px] font-extrabold text-[#8b5cf6]">
              {money(stats.incentive)}
            </span>
          </div>
          <p className="pt-1 text-[11.5px] text-[#8a94a6]">
            Calculated on the base fee — GST and TDS are excluded. Candidates added this period:{" "}
            <b className="text-[#42506b]">{candidatesAdded}</b>.
          </p>
        </div>
      </div>

      <div className="mt-[18px] grid grid-cols-[1.5fr_1fr] items-start gap-[18px]">
        {/* placements */}
        <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
          <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-3.5">
            <span className="text-[15px] font-extrabold">Placements in period</span>
            <span className="tf-num rounded-full bg-[#eef4fe] px-2.5 py-[3px] text-[11.5px] font-bold text-[#2a6fdb]">
              {inPeriod.length}
            </span>
          </div>
          {inPeriod.map((pl) => (
            <Link
              key={pl.id}
              href={`/placements/${pl.id}`}
              className="flex items-center gap-3 border-b border-[#f4f6fa] px-5 py-3 last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[#16203a]">
                  {pl.candidate_name}
                </div>
                <div className="truncate text-[11px] font-medium text-[#a3acbd]">
                  {(pl.client_id ? clientName.get(pl.client_id) : "") || pl.client_name} · joined{" "}
                  {format(new Date(pl.joining_date + "T00:00:00"), "dd MMM yy")}
                </div>
              </div>
              <div className="text-right">
                <div className="tf-num text-[13px] font-extrabold">{money(pl.fee_amount)}</div>
                <div className="text-[10.5px] font-medium text-[#a3acbd]">base fee</div>
              </div>
              <PlacementStatusBadge placement={pl} />
            </Link>
          ))}
          {inPeriod.length === 0 && (
            <div className="py-10 text-center text-[13px] font-semibold text-[#a3acbd]">
              No placements in this period.
            </div>
          )}
        </div>

        {/* payments + open pipeline of money */}
        <div className="space-y-[18px]">
          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-extrabold">Payments received</span>
              <span className="tf-num rounded-full bg-[#e9f9ef] px-2.5 py-[3px] text-[11.5px] font-bold text-[#16a34a]">
                {money(stats.collectedCash)}
              </span>
            </div>
            {periodPayments.slice(0, 8).map((pay) => {
              const pl = placements.find((x) => x.id === pay.placement_id);
              return (
                <div
                  key={pay.id}
                  className="flex items-center gap-3 border-b border-[#f4f6fa] py-2.5 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="tf-num text-[13px] font-extrabold">{money(pay.amount)}</div>
                    <div className="truncate text-[11px] text-[#8a94a6]">
                      {pl?.candidate_name ?? "—"} ·{" "}
                      {format(new Date(pay.paid_on + "T00:00:00"), "dd MMM yy")}
                    </div>
                  </div>
                </div>
              );
            })}
            {periodPayments.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                Nothing received in this period.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#e9edf3] bg-white p-[20px]">
            <div className="mb-1 flex items-center gap-2">
              <Users size={14} className="text-[#e8833a]" />
              <span className="text-[14px] font-extrabold">Still to collect</span>
            </div>
            <div className="mb-3 text-[11.5px] text-[#8a94a6]">
              Open placements billed by {profile.name.split(" ")[0]}
            </div>
            {openPlacements.slice(0, 6).map((pl) => {
              const od = placementOverdue(pl);
              return (
                <Link
                  key={pl.id}
                  href={`/placements/${pl.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-[10px] border-b border-[#f0f3f8] px-2 py-2.5 last:border-0 hover:bg-[#f6f8fb]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-bold">{pl.candidate_name}</div>
                    <div className={`text-[10.5px] font-semibold ${od ? "text-[#dc2626]" : "text-[#a3acbd]"}`}>
                      due{" "}
                      {pl.due_date ? format(new Date(pl.due_date + "T00:00:00"), "dd MMM yy") : "—"}
                    </div>
                  </div>
                  <div className={`tf-num text-[12.5px] font-extrabold ${od ? "text-[#dc2626]" : ""}`}>
                    {money(placementBalance(pl))}
                  </div>
                </Link>
              );
            })}
            {openPlacements.length === 0 && (
              <div className="py-4 text-center text-[12px] font-semibold text-[#a3acbd]">
                All collected 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-[#7a8696]">{label}</span>
      <span className="tf-num font-bold text-[#16203a]">{value}</span>
    </div>
  );
}
