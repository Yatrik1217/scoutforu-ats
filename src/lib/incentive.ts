// Recruiter performance & incentive helpers — safe for server & client.
import { round2 } from "@/lib/invoice";
import type {
  IncentiveSettingsRow,
  IncentiveSlab,
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

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Financial year that a date falls in (returns the starting calendar year).
function fyStartYear(d: Date): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
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
