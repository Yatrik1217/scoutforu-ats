// Placement (recruitment revenue) domain helpers — safe for server & client.
import { round2 } from "@/lib/invoice";
import type { PlacementRow, PlacementStatus, PlacementFeeMode } from "@/lib/database.types";

export const PLACEMENT_STATUS_META: Record<PlacementStatus, { label: string; color: string }> = {
  pending: { label: "Awaiting Payment", color: "#2a6fdb" },
  invoiced: { label: "Invoiced", color: "#8b5cf6" },
  partial: { label: "Partially Paid", color: "#e8833a" },
  paid: { label: "Paid", color: "#16a34a" },
  replaced: { label: "Replacement", color: "#b45309" },
  cancelled: { label: "Cancelled", color: "#94a3b8" },
  written_off: { label: "Written Off", color: "#64748b" },
};

// Statuses where money is still expected.
export const OPEN_PLACEMENT_STATUSES: PlacementStatus[] = ["pending", "invoiced", "partial"];

export function placementBalance(p: Pick<PlacementRow, "total_fee" | "amount_received">): number {
  return round2(Math.max(0, p.total_fee - p.amount_received));
}

export function placementOverdue(
  p: Pick<PlacementRow, "status" | "due_date">,
  today = new Date(),
): boolean {
  if (!OPEN_PLACEMENT_STATUSES.includes(p.status) || !p.due_date) return false;
  return new Date(p.due_date + "T23:59:59") < today;
}

export function daysUntilDue(p: Pick<PlacementRow, "due_date">, today = new Date()): number {
  if (!p.due_date) return 0;
  return Math.round((+new Date(p.due_date + "T00:00:00") - +today) / 86_400_000);
}

export function withinGuarantee(
  p: Pick<PlacementRow, "replacement_until">,
  today = new Date(),
): boolean {
  return !!p.replacement_until && new Date(p.replacement_until + "T23:59:59") >= today;
}

// ---- fee math ----------------------------------------------------------------
export function computeFee(input: {
  feeMode: PlacementFeeMode;
  annualCtc: number;
  feePercent: number;
  flatFee: number;
  gstApplicable: boolean;
  gstPercent: number;
}) {
  const base =
    input.feeMode === "percent"
      ? round2(((input.annualCtc || 0) * (input.feePercent || 0)) / 100)
      : round2(input.flatFee || 0);
  const gst = input.gstApplicable ? round2((base * (input.gstPercent || 0)) / 100) : 0;
  return { fee: base, gst, total: round2(base + gst) };
}

// ---- dates -------------------------------------------------------------------
export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Common credit terms from the date of joining.
export const CREDIT_TERMS = [
  { days: 0, label: "On joining" },
  { days: 15, label: "15 days" },
  { days: 30, label: "30 days" },
  { days: 45, label: "45 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
];

export const GUARANTEE_TERMS = [
  { days: 0, label: "No guarantee" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
];

// ---- receivables aging (by how overdue the payment is) -----------------------
export const PLACEMENT_AGING_BUCKETS = [
  "Not due",
  "1–30 days",
  "31–60 days",
  "61–90 days",
  "90+ days",
] as const;

export function placementAgingBucket(
  p: Pick<PlacementRow, "status" | "due_date">,
  today = new Date(),
): number {
  if (!placementOverdue(p, today)) return 0;
  const d = -daysUntilDue(p, today);
  if (d <= 30) return 1;
  if (d <= 60) return 2;
  if (d <= 90) return 3;
  return 4;
}
