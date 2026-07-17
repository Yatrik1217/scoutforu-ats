import { hexA } from "@/lib/domain";
import { STATUS_META, isOverdue } from "@/lib/invoice";
import type { InvoiceRow } from "@/lib/database.types";

export function InvoiceStatusBadge({
  invoice,
}: {
  invoice: Pick<InvoiceRow, "status" | "due_date">;
}) {
  const overdue = isOverdue(invoice);
  const meta = overdue ? { label: "Overdue", color: "#dc2626" } : STATUS_META[invoice.status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: meta.color, background: hexA(meta.color, 0.12) }}
    >
      {meta.label}
    </span>
  );
}
