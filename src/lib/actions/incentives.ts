"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IncentiveBasis, IncentiveMode, IncentiveSlab } from "@/lib/database.types";

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

  const { error } = await sb
    .from("incentive_settings")
    .update({
      basis: input.basis,
      mode: input.mode,
      flat_percent: Number(input.flatPercent) || 0,
      slabs,
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
