// Shared invoice domain helpers — safe for both server and client components.
import type { InvoiceRow, InvoiceStatus, InvoiceTaxMode, PaymentMethod, RecurringFrequency } from "@/lib/database.types";

// ---- money (Indian grouping: 12,34,567.00) ----------------------------------
const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const money = (n: number) => `₹${inr.format(round2(n))}`;
export const moneyShort = (n: number) =>
  Math.abs(n) >= 10_000_000
    ? `₹${(n / 10_000_000).toFixed(2)} Cr`
    : Math.abs(n) >= 100_000
      ? `₹${(n / 100_000).toFixed(2)} L`
      : `₹${inr0.format(Math.round(n))}`;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---- status ----------------------------------------------------------------
export const STATUS_META: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#64748b" },
  sent: { label: "Sent", color: "#2a6fdb" },
  viewed: { label: "Viewed", color: "#8b5cf6" },
  partial: { label: "Partially Paid", color: "#e8833a" },
  paid: { label: "Paid", color: "#16a34a" },
  void: { label: "Void", color: "#94a3b8" },
  written_off: { label: "Written Off", color: "#b45309" },
};

export const OPEN_STATUSES: InvoiceStatus[] = ["sent", "viewed", "partial"];

export function isOverdue(inv: Pick<InvoiceRow, "status" | "due_date">, today = new Date()): boolean {
  if (!OPEN_STATUSES.includes(inv.status) || !inv.due_date) return false;
  return new Date(inv.due_date + "T23:59:59") < today;
}

export function balanceDue(inv: Pick<InvoiceRow, "total" | "amount_paid">): number {
  return round2(Math.max(0, inv.total - inv.amount_paid));
}

export function daysOverdue(inv: Pick<InvoiceRow, "due_date">, today = new Date()): number {
  if (!inv.due_date) return 0;
  return Math.max(0, Math.floor((+today - +new Date(inv.due_date)) / 86_400_000));
}

// ---- totals ----------------------------------------------------------------
export type ItemInput = { description: string; details: string; qty: number; rate: number };

export function computeTotals(
  items: ItemInput[],
  discountPercent: number,
  gstPercent: number,
  taxMode: InvoiceTaxMode,
) {
  const subtotal = round2(items.reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0));
  const discount = round2((subtotal * (discountPercent || 0)) / 100);
  const taxable = round2(subtotal - discount);
  const tax = taxMode === "none" ? 0 : round2((taxable * (gstPercent || 0)) / 100);
  const total = round2(taxable + tax);
  return { subtotal, discount, taxable, tax, total };
}

// ---- labels ----------------------------------------------------------------
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank Transfer / NEFT",
  upi: "UPI",
  cheque: "Cheque",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export const FREQ_LABEL: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-yearly",
  yearly: "Yearly",
};

export const TAX_MODE_LABEL: Record<InvoiceTaxMode, string> = {
  cgst_sgst: "CGST + SGST (intra-state)",
  igst: "IGST (inter-state)",
  none: "No tax",
};

export const TERMS_PRESETS = [
  { days: 0, label: "Due on receipt" },
  { days: 15, label: "Net 15" },
  { days: 30, label: "Net 30" },
  { days: 45, label: "Net 45" },
  { days: 60, label: "Net 60" },
];

export function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextRecurringDate(dateISO: string, freq: RecurringFrequency): string {
  const d = new Date(dateISO + "T00:00:00");
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  else if (freq === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (freq === "half_yearly") d.setMonth(d.getMonth() + 6);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

// ---- receivables aging -------------------------------------------------------
export const AGING_BUCKETS = ["Current", "1–15 days", "16–30 days", "31–45 days", "45+ days"] as const;

export function agingBucket(inv: Pick<InvoiceRow, "status" | "due_date" | "total" | "amount_paid">): number {
  if (!isOverdue(inv as Pick<InvoiceRow, "status" | "due_date">)) return 0;
  const d = daysOverdue(inv);
  if (d <= 15) return 1;
  if (d <= 30) return 2;
  if (d <= 45) return 3;
  return 4;
}

// ---- amount in words (Indian system) -----------------------------------------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return (TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")).trim();
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return ((h ? ONES[h] + " Hundred" : "") + (rest ? (h ? " " : "") + twoDigits(rest) : "")).trim();
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";
  const crore = Math.floor(rupees / 10_000_000);
  const lakh = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1000);
  const rest = rupees % 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  let out = parts.length ? parts.join(" ") + " Rupees" : "";
  if (paise) out += (out ? " and " : "") + twoDigits(paise) + " Paise";
  return out + " Only";
}
