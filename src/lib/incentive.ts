// Recruiter performance & incentive helpers — safe for server & client.
import { round2, toISODate } from "@/lib/invoice";
import type {
  IncentiveSettingsRow,
  IncentiveSlab,
  QuarterTier,
  BonusTier,
  PlacementRow,
  PlacementPaymentRow,
} from "@/lib/database.types";

// ---- reporting periods (Indian FY runs Apr 1 → Mar 31) -----------------------
export type PeriodKey =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_fy"
  | "last_fy"
  | "all";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "this_fy", label: "This FY" },
  { key: "last_fy", label: "Last FY" },
  { key: "all", label: "All time" },
];

const iso = toISODate;

// Financial year that a date falls in (returns the starting calendar year).
export function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export function fyLabel(startYear: number): string {
  return `FY ${startYear}–${String(startYear + 1).slice(2)}`;
}

// FY quarters: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar.
export function fyQuarterRange(
  startYear: number,
  q: 0 | 1 | 2 | 3,
): { from: string; to: string; label: string } {
  const startMonth = 3 + q * 3; // 3 = April
  const from = new Date(startYear, startMonth, 1);
  const to = new Date(startYear, startMonth + 3, 0);
  return { from: iso(from), to: iso(to), label: `Q${q + 1}` };
}

// FY halves: H1 Apr–Sep, H2 Oct–Mar.
export function fyHalfRange(
  startYear: number,
  h: 0 | 1,
): { from: string; to: string; label: string } {
  const a = fyQuarterRange(startYear, h === 0 ? 0 : 2);
  const b = fyQuarterRange(startYear, h === 0 ? 1 : 3);
  return { from: a.from, to: b.to, label: h === 0 ? "H1 (Apr–Sep)" : "H2 (Oct–Mar)" };
}

export function fyRange(startYear: number) {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31`, label: fyLabel(startYear) };
}

export function periodRange(
  key: PeriodKey,
  today = new Date(),
): { from: string; to: string; label: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (key) {
    case "this_month":
      return {
        from: iso(new Date(y, m, 1)),
        to: iso(new Date(y, m + 1, 0)),
        label: today.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      };
    case "last_month": {
      const d = new Date(y, m - 1, 1);
      return {
        from: iso(d),
        to: iso(new Date(y, m, 0)),
        label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
      };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return {
        from: iso(new Date(y, q * 3, 1)),
        to: iso(new Date(y, q * 3 + 3, 0)),
        label: `Q${q + 1} ${y}`,
      };
    }
    case "this_fy": {
      const s = fyStartYear(today);
      return { from: `${s}-04-01`, to: `${s + 1}-03-31`, label: `FY ${s}–${String(s + 1).slice(2)}` };
    }
    case "last_fy": {
      const s = fyStartYear(today) - 1;
      return { from: `${s}-04-01`, to: `${s + 1}-03-31`, label: `FY ${s}–${String(s + 1).slice(2)}` };
    }
    default:
      return { from: "0000-01-01", to: "9999-12-31", label: "All time" };
  }
}

export const inRange = (dateISO: string | null, r: { from: string; to: string }) =>
  !!dateISO && dateISO >= r.from && dateISO <= r.to;

// ---- incentive computation ---------------------------------------------------

// Slab rate: the bracket the period total lands in sets the rate for the whole
// amount (the common Indian sales-incentive convention, not progressive).
export function slabPercent(amount: number, slabs: IncentiveSlab[]): number {
  const sorted = [...(slabs ?? [])].sort(
    (a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity),
  );
  for (const s of sorted) if (s.upto == null || amount <= s.upto) return s.percent || 0;
  return sorted.length ? (sorted[sorted.length - 1].percent ?? 0) : 0;
}

export function incentiveRate(
  basisAmount: number,
  settings: IncentiveSettingsRow | null,
  recruiterOverride?: number | null,
): number {
  if (!settings) return recruiterOverride ?? 0;
  if (settings.mode === "slab") return slabPercent(basisAmount, settings.slabs);
  return recruiterOverride ?? settings.flat_percent ?? 0;
}

export function computeIncentive(
  basisAmount: number,
  settings: IncentiveSettingsRow | null,
  recruiterOverride?: number | null,
): { rate: number; amount: number } {
  const rate = incentiveRate(basisAmount, settings, recruiterOverride);
  return { rate, amount: round2((basisAmount * rate) / 100) };
}

// ---- revenue attribution -----------------------------------------------------

// A payment covers fee + GST minus TDS. Only the FEE share earns incentive, so
// prorate each receipt back to its base-fee portion.
export function feeShareOfPayment(payment: number, placement: PlacementRow): number {
  const collectible = placement.net_payable > 0 ? placement.net_payable : placement.total_fee;
  if (collectible <= 0) return 0;
  return round2((payment * placement.fee_amount) / collectible);
}

// ---- closure-count incentive plan --------------------------------------------

// A closure counts once the candidate has stayed the minimum tenure and (if
// required) the client's invoice is fully settled. Cancelled placements and
// candidates who left inside the guarantee never count.
export function closureEligible(
  p: PlacementRow,
  settings: Pick<IncentiveSettingsRow, "min_tenure_days" | "require_collected">,
  today = new Date(),
): boolean {
  if (p.status === "cancelled" || p.status === "replaced") return false;
  if (settings.require_collected && p.status !== "paid") return false;
  const joined = new Date(p.joining_date + "T00:00:00");
  const daysServed = Math.floor((+today - +joined) / 86_400_000);
  return daysServed >= (settings.min_tenure_days ?? 0);
}

// A placement is "achieved" (work done) even if not yet payable.
export function closureAchieved(p: PlacementRow): boolean {
  return p.status !== "cancelled" && p.status !== "replaced";
}

export function quarterTierFor(count: number, tiers: QuarterTier[]): QuarterTier | null {
  if (count <= 0) return null;
  const sorted = [...(tiers ?? [])].sort((a, b) => a.from - b.from);
  for (const t of sorted) if (count >= t.from && (t.to == null || count <= t.to)) return t;
  return sorted.length ? sorted[sorted.length - 1] : null;
}

export function quarterPayout(
  count: number,
  tiers: QuarterTier[],
): { perClosure: number; base: number; bonus: number; total: number } {
  const tier = quarterTierFor(count, tiers);
  if (!tier || count <= 0) return { perClosure: 0, base: 0, bonus: 0, total: 0 };
  const base = round2(count * (tier.per_closure || 0));
  const bonus =
    tier.bonus && tier.bonus_at != null && count >= tier.bonus_at ? tier.bonus : 0;
  return { perClosure: tier.per_closure || 0, base, bonus, total: round2(base + bonus) };
}

export function bonusTierFor(count: number, tiers: BonusTier[]): BonusTier | null {
  if (count <= 0) return null;
  const sorted = [...(tiers ?? [])].sort((a, b) => a.from - b.from);
  for (const t of sorted) if (count >= t.from && (t.to == null || count <= t.to)) return t;
  return null;
}

export type QuarterResult = {
  label: string;
  from: string;
  to: string;
  achieved: number;
  eligible: number;
  perClosure: number;
  base: number;
  bonus: number;
  total: number;
};

export type ClosureStatement = {
  fyLabel: string;
  quarters: QuarterResult[];
  halves: {
    label: string;
    eligible: number;
    bonus: number;
    qualified: boolean;
    note: string;
  }[];
  annual: { eligible: number; bonus: number; reward: string; note: string };
  quarterlyTotal: number;
  halfYearlyTotal: number;
  annualTotal: number;
  total: number;
  achievedTotal: number;
  pendingClosures: number; // achieved but not yet payable
};

// Full per-recruiter incentive statement for one financial year.
export function buildClosureStatement(input: {
  placements: PlacementRow[]; // this recruiter's placements only
  settings: IncentiveSettingsRow;
  startYear: number;
  today?: Date;
}): ClosureStatement {
  const { placements, settings, startYear } = input;
  const today = input.today ?? new Date();

  const countIn = (r: { from: string; to: string }) => {
    const inWindow = placements.filter((p) => inRange(p.joining_date, r));
    return {
      achieved: inWindow.filter(closureAchieved).length,
      eligible: inWindow.filter((p) => closureEligible(p, settings, today)).length,
    };
  };

  const quarters: QuarterResult[] = ([0, 1, 2, 3] as const).map((q) => {
    const r = fyQuarterRange(startYear, q);
    const { achieved, eligible } = countIn(r);
    const pay = quarterPayout(eligible, settings.quarterly_tiers);
    return { label: r.label, from: r.from, to: r.to, achieved, eligible, ...pay };
  });

  const halves = ([0, 1] as const).map((h) => {
    const r = fyHalfRange(startYear, h);
    const { eligible } = countIn(r);
    const qA = quarters[h === 0 ? 0 : 2];
    const qB = quarters[h === 0 ? 1 : 3];
    const bothMet =
      !settings.halfyearly_requires_both ||
      (qA.eligible >= settings.quarterly_min_target &&
        qB.eligible >= settings.quarterly_min_target);
    const tier = bonusTierFor(eligible, settings.halfyearly_tiers);
    const qualified = !!tier && bothMet;
    return {
      label: r.label,
      eligible,
      bonus: qualified ? tier!.bonus : 0,
      qualified,
      note:
        tier && !bothMet
          ? `Needs ${settings.quarterly_min_target}+ closures in both quarters`
          : "",
    };
  });

  const annualRange = fyRange(startYear);
  const annualCount = countIn(annualRange);
  const annualTier = bonusTierFor(annualCount.eligible, settings.annual_tiers);

  const quarterlyTotal = round2(quarters.reduce((s, q) => s + q.total, 0));
  const halfYearlyTotal = round2(halves.reduce((s, h) => s + h.bonus, 0));
  const annualTotal = annualTier?.bonus ?? 0;

  return {
    fyLabel: fyLabel(startYear),
    quarters,
    halves,
    annual: {
      eligible: annualCount.eligible,
      bonus: annualTotal,
      reward: annualTier?.reward ?? "",
      note: "",
    },
    quarterlyTotal,
    halfYearlyTotal,
    annualTotal,
    total: round2(quarterlyTotal + halfYearlyTotal + annualTotal),
    achievedTotal: annualCount.achieved,
    pendingClosures: Math.max(0, annualCount.achieved - annualCount.eligible),
  };
}

export type RecruiterStats = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  incentivePercent: number | null;
  placements: number;
  bookedFee: number; // base fee (excl GST) of placements joined in the period
  bookedTotal: number; // invoice value incl GST
  collectedFee: number; // base-fee share of cash received in the period
  collectedCash: number; // actual money received in the period
  outstanding: number; // still to collect on their open placements (current)
  basisAmount: number;
  incentiveRate: number;
  incentive: number;
};

export function buildRecruiterStats(input: {
  recruiters: { id: string; name: string; color: string; active: boolean; incentive_percent: number | null }[];
  placements: PlacementRow[];
  payments: PlacementPaymentRow[];
  range: { from: string; to: string };
  settings: IncentiveSettingsRow | null;
  balanceOf: (p: PlacementRow) => number;
}): RecruiterStats[] {
  const { recruiters, placements, payments, range, settings, balanceOf } = input;
  const byId = new Map(placements.map((p) => [p.id, p]));

  return recruiters
    .map((r) => {
      const mine = placements.filter(
        (p) => p.recruiter_id === r.id && p.status !== "cancelled",
      );
      const joinedInPeriod = mine.filter((p) => inRange(p.joining_date, range));
      const bookedFee = round2(joinedInPeriod.reduce((s, p) => s + p.fee_amount, 0));
      const bookedTotal = round2(joinedInPeriod.reduce((s, p) => s + p.total_fee, 0));

      const myPayments = payments.filter((pay) => {
        const pl = byId.get(pay.placement_id);
        return pl && pl.recruiter_id === r.id && inRange(pay.paid_on, range);
      });
      const collectedCash = round2(myPayments.reduce((s, pay) => s + pay.amount, 0));
      const collectedFee = round2(
        myPayments.reduce((s, pay) => {
          const pl = byId.get(pay.placement_id)!;
          return s + feeShareOfPayment(pay.amount, pl);
        }, 0),
      );

      const outstanding = round2(mine.reduce((s, p) => s + balanceOf(p), 0));
      const basisAmount = settings?.basis === "booked" ? bookedFee : collectedFee;
      const { rate, amount } = computeIncentive(basisAmount, settings, r.incentive_percent);

      return {
        id: r.id,
        name: r.name,
        color: r.color,
        active: r.active,
        incentivePercent: r.incentive_percent,
        placements: joinedInPeriod.length,
        bookedFee,
        bookedTotal,
        collectedFee,
        collectedCash,
        outstanding,
        basisAmount,
        incentiveRate: rate,
        incentive: amount,
      };
    })
    .sort((a, b) => b.basisAmount - a.basisAmount || b.bookedFee - a.bookedFee);
}
