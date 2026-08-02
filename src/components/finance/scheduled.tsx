import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { money } from "@/lib/invoice";
import { PostDueButton } from "@/components/finance/post-due-button";
import { PayDueButton } from "@/components/finance/pay-due-button";
import type { DueItem } from "@/lib/finance";

// Forward look at recurring payments scheduled for a month, before they're paid.
// For the current month it offers "Post due payments" to convert them to actual
// entries; for a future month it's an informational projection.
export function ScheduledPayments({
  items,
  monthLabel,
  isCurrentMonth,
}: {
  items: DueItem[];
  monthLabel: string;
  isCurrentMonth: boolean;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="mt-5 rounded-[14px] border border-[#fde68a] bg-[#fffbeb] p-[18px_20px]">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-[14px] font-extrabold text-[#92400e]">Scheduled in {monthLabel}</div>
        <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-bold text-[#b45309]">
          not yet paid
        </span>
        <div className="flex-1" />
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#b45309]">Scheduled total</div>
          <div className="text-[18px] font-extrabold tabular-nums text-[#92400e]">{money(total)}</div>
        </div>
        {isCurrentMonth && <PostDueButton />}
      </div>

      <div className="flex flex-col divide-y divide-[#fde6b8]">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: `${it.color}20`, color: it.color }}>
              <CalendarClock size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">
                {it.label}
                <span className="ml-1.5 rounded-full px-1.5 py-px text-[9.5px] font-bold align-middle" style={{ background: `${it.color}20`, color: it.color }}>
                  {it.tag}
                </span>
              </div>
              <div className="text-[11.5px] font-semibold text-[#a16207]">
                due {format(new Date(it.date + "T00:00:00"), "d MMM")}
              </div>
            </div>
            <div className="text-[13px] font-bold tabular-nums text-[#92400e]">{money(it.amount)}</div>
            {isCurrentMonth && it.emiId && <PayDueButton emiId={it.emiId} paidOn={it.date} />}
          </div>
        ))}
      </div>

      <div className="mt-3 text-[11.5px] font-medium text-[#a16207]">
        {isCurrentMonth
          ? "Click Post due payments to record these as paid — they'll then appear in Transactions."
          : `A projection from your recurring entries. In ${monthLabel}, mark them paid (Pay or Post due payments) and they'll move into Transactions like a normal month.`}
      </div>
    </div>
  );
}
