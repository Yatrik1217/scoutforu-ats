// Presentational, server-safe finance pieces (no hooks — usable inside RSC).
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { money, moneyShort } from "@/lib/invoice";
import type { CategoryTotal } from "@/lib/finance";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "#2a6fdb",
  href,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  color?: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-[14px] border border-[#e9edf3] bg-white p-[16px_18px] transition hover:border-[#d6deea]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[#8a94a6]">
          {label}
        </span>
        {Icon && (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[9px]"
            style={{ background: `${color}18`, color }}
          >
            <Icon size={17} />
          </span>
        )}
      </div>
      <div className="mt-2 text-[24px] font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[12px] font-semibold text-[#8a94a6]">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[14px] border border-[#e9edf3] bg-white p-[18px_20px] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <div className="text-[14px] font-extrabold">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// Horizontal category-spend bars.
export function CategoryBars({ rows, total }: { rows: CategoryTotal[]; total: number }) {
  if (rows.length === 0)
    return <div className="py-6 text-center text-[13px] text-[#8a94a6]">No expenses recorded yet.</div>;
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.categoryId ?? r.name} className="flex items-center gap-3">
          <div className="w-[130px] shrink-0 truncate text-[12.5px] font-semibold" title={r.name}>
            {r.name}
          </div>
          <div className="h-[22px] flex-1 overflow-hidden rounded-[6px] bg-[#f1f4f9]">
            <div
              className="flex h-full items-center justify-end rounded-[6px] pr-2 text-[10.5px] font-bold text-white"
              style={{ width: `${Math.max(6, (r.amount / max) * 100)}%`, background: r.color }}
            >
              {total > 0 ? `${Math.round((r.amount / total) * 100)}%` : ""}
            </div>
          </div>
          <div className="w-[92px] shrink-0 text-right text-[12.5px] font-bold tabular-nums">
            {moneyShort(r.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

// A single P&L statement line.
export function PLLine({
  label,
  value,
  strong,
  accent,
  hint,
}: {
  label: string;
  value: number;
  strong?: boolean;
  accent?: string;
  hint?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${strong ? "border-t border-[#e9edf3]" : ""}`}
    >
      <div className={`text-[13px] ${strong ? "font-extrabold" : "font-semibold text-[#42506b]"}`}>
        {label}
        {hint && <span className="ml-1.5 text-[11px] font-medium text-[#9aa4b6]">{hint}</span>}
      </div>
      <div
        className={`tabular-nums ${strong ? "text-[15px] font-extrabold" : "text-[13px] font-bold"}`}
        style={accent ? { color: accent } : undefined}
      >
        {value < 0 ? `(${money(Math.abs(value))})` : money(value)}
      </div>
    </div>
  );
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
