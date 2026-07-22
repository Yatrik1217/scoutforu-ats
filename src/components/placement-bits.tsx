import { hexA } from "@/lib/domain";
import { PLACEMENT_STATUS_META, placementOverdue } from "@/lib/placement";
import type { PlacementRow } from "@/lib/database.types";

export function PlacementStatusBadge({
  placement,
}: {
  placement: Pick<PlacementRow, "status" | "due_date">;
}) {
  const overdue = placementOverdue(placement);
  const meta = overdue ? { label: "Overdue", color: "#dc2626" } : PLACEMENT_STATUS_META[placement.status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: meta.color, background: hexA(meta.color, 0.12) }}
    >
      {meta.label}
    </span>
  );
}
