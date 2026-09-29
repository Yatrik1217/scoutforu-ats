"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  IncentiveBasis,
  IncentiveMode,
  IncentiveSlab,
  QuarterTier,
  BonusTier,
  PaymentMethod,
} from "@/lib/database.types";

type Result = { ok: boolean; error?: string; message?: string };

async function requireAdmin() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { sb, me: null };
  const { data: me } = await sb
    .from("profiles")
    .select("id,role")
    .eq("id", user.id)
    .maybeSingle();
  if (!me || me.role !== "master_admin") return { sb, me: null };
  return { sb, me };
}

export async function updateIncentiveSettings(input: {
  basis: IncentiveBasis;
  mode: IncentiveMode;
  flatPercent: number;
  slabs: IncentiveSlab[];
  quarterlyTiers?: QuarterTier[];
  halfyearlyTiers?: BonusTier[];
  annualTiers?: BonusTier[];
  minTenureDays?: number;
  requireCollected?: boolean;
  quarterlyMinTarget?: number;
  halfyearlyRequiresBoth?: boolean;
}): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can change incentive settings." };

  const slabs = (input.slabs ?? [])
    .map((s) => ({
      upto: s.upto == null || Number.isNaN(s.upto) ? null : Number(s.upto),
      percent: Number(s.percent) || 0,
    }))
    .filter((s) => s.percent > 0 || s.upto != null);
  if (input.mode === "slab" && !slabs.length)
    return { ok: false, error: "Add at least one slab, or switch to a flat percentage." };
  if (input.mode === "slab" && !slabs.some((s) => s.upto == null))
    return {
      ok: false,
      error: "Add a final open-ended slab (leave its 'up to' blank) so large totals are covered.",
    };

  const cleanQuarter = (input.quarterlyTiers ?? [])
    .map((t) => ({
      from: Math.max(1, Number(t.from) || 1),
      to: t.to == null || Number.isNaN(t.to) ? null : Number(t.to),
      per_closure: Number(t.per_closure) || 0,
      bonus: Number(t.bonus) || 0,
      bonus_at: t.bonus_at == null || Number.isNaN(t.bonus_at) ? null : Number(t.bonus_at),
    }))
    .sort((a, b) => a.from - b.from);
  const cleanBonus = (rows: BonusTier[] | undefined) =>
    (rows ?? [])
      .map((t) => ({
        from: Math.max(1, Number(t.from) || 1),
        to: t.to == null || Number.isNaN(t.to) ? null : Number(t.to),
        bonus: Number(t.bonus) || 0,
        reward: (t.reward ?? "").trim(),
      }))
      .sort((a, b) => a.from - b.from);

  if (input.mode === "closure" && !cleanQuarter.length)
    return { ok: false, error: "Add at least one quarterly closure tier." };
  if (input.mode === "closure" && !cleanQuarter.some((t) => t.to == null))
    return {
      ok: false,
      error: "Leave the top quarterly tier's 'to' blank so high performers are covered.",
    };

  const { error } = await sb
    .from("incentive_settings")
    .update({
      basis: input.basis,
      mode: input.mode,
      flat_percent: Number(input.flatPercent) || 0,
      slabs,
      quarterly_tiers: cleanQuarter,
      halfyearly_tiers: cleanBonus(input.halfyearlyTiers),
      annual_tiers: cleanBonus(input.annualTiers),
      min_tenure_days: Math.max(0, Number(input.minTenureDays ?? 30)),
      require_collected: input.requireCollected ?? true,
      quarterly_min_target: Math.max(0, Number(input.quarterlyMinTarget ?? 2)),
      halfyearly_requires_both: input.halfyearlyRequiresBoth ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Incentive scheme saved" };
}

// Per-recruiter override of the flat percentage (null = use the firm default).
export async function setRecruiterIncentive(
  profileId: string,
  percent: number | null,
): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can change incentive settings." };
  const value =
    percent == null || Number.isNaN(percent) ? null : Math.max(0, Number(percent));
  const { error } = await sb
    .from("profiles")
    .update({ incentive_percent: value })
    .eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: value == null ? "Using the firm default" : `Set to ${value}%` };
}

// ---- incentive payout ledger -------------------------------------------------
// Record money actually handed to a recruiter against their earned incentive.
// Optionally tagged to one placement (candidate) so a per-candidate tally works.
const PAYOUT_METHODS: PaymentMethod[] = [
  "bank_transfer",
  "upi",
  "cheque",
  "cash",
  "card",
  "other",
];

export async function recordIncentivePayout(input: {
  recruiterId: string;
  amount: number;
  paidOn: string; // ISO date
  placementId?: string | null;
  method?: PaymentMethod;
  reference?: string;
  notes?: string;
}): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can record incentive payouts." };

  const amount = Number(input.amount);
  if (!input.recruiterId) return { ok: false, error: "Missing recruiter." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "Enter a payout amount greater than zero." };
  const paidOn = (input.paidOn || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn))
    return { ok: false, error: "Pick a valid payout date." };
  const method: PaymentMethod = PAYOUT_METHODS.includes(input.method as PaymentMethod)
    ? (input.method as PaymentMethod)
    : "bank_transfer";

  const { error } = await sb.from("incentive_payouts").insert({
    recruiter_id: input.recruiterId,
    placement_id: input.placementId || null,
    amount: Math.round(amount * 100) / 100,
    paid_on: paidOn,
    method,
    reference: (input.reference ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/performance", "layout");
  return { ok: true, message: "Payout recorded" };
}

export async function deleteIncentivePayout(id: string): Promise<Result> {
  const { sb, me } = await requireAdmin();
  if (!me) return { ok: false, error: "Only the Master Admin can delete incentive payouts." };
  if (!id) return { ok: false, error: "Missing payout." };
  const { error } = await sb.from("incentive_payouts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/performance", "layout");
  return { ok: true, message: "Payout removed" };
}
