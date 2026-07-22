import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/invoice";
import {
  placementBalance,
  placementOverdue,
  daysUntilDue,
  OPEN_PLACEMENT_STATUSES,
} from "@/lib/placement";
import { PlacementStatusBadge } from "@/components/placement-bits";
import { NewPlacementButton } from "@/components/placement-actions";
import type { PlacementRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Awaiting Payment" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
  { key: "replaced", label: "Replacement" },
  { key: "closed", label: "Cancelled / Written off" },
] as const;

export default async function AllPlacementsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const { f = "all", q = "" } = await searchParams;

  const sb = await createClient();
  const [{ data }, { data: clientRows }] = await Promise.all([
    sb.from("placements").select("*").order("joining_date", { ascending: false }),
    sb.from("clients").select("id,name"),
  ]);
  let rows = (data ?? []) as PlacementRow[];
  const clientName = new Map((clientRows ?? []).map((c) => [c.id, c.name]));

  const now = new Date();
  if (f === "open") rows = rows.filter((p) => OPEN_PLACEMENT_STATUSES.includes(p.status));
  else if (f === "overdue") rows = rows.filter((p) => placementOverdue(p, now));
  else if (f === "paid") rows = rows.filter((p) => p.status === "paid");
  else if (f === "replaced") rows = rows.filter((p) => p.status === "replaced");
  else if (f === "closed") rows = rows.filter((p) => ["cancelled", "written_off"].includes(p.status));

  const needle = q.trim().toLowerCase();
  if (needle)
    rows = rows.filter(
      (p) =>
        p.candidate_name.toLowerCase().includes(needle) ||
        p.client_name.toLowerCase().includes(needle) ||
        (p.client_id && (clientName.get(p.client_id) ?? "").toLowerCase().includes(needle)) ||
        p.position.toLowerCase().includes(needle),
    );

  const totalFee = rows.reduce((s, p) => s + p.total_fee, 0);
  const totalDue = rows.reduce((s, p) => s + placementBalance(p), 0);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            All Placements
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            {rows.length} placement{rows.length === 1 ? "" : "s"} · {money(totalFee)} in fees ·{" "}
            {money(totalDue)} outstanding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/placements"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            ← Dashboard
          </Link>
          <NewPlacementButton />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-[11px] bg-[#e6eaf1] p-1">
          {FILTERS.map((t) => (
            <Link
              key={t.key}
              href={`/placements/all?f=${t.key}${needle ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                f === t.key ? "bg-white text-[#16203a] shadow-sm" : "text-[#68758c] hover:text-[#42506b]"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form action="/placements/all" className="flex items-center gap-2">
          <input type="hidden" name="f" value={f} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search candidate, client…"
            className="w-[240px] rounded-[9px] border border-[#e3e8f0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6fdb]"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.4fr_1.1fr_105px_105px_130px_130px_120px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Candidate</div>
          <div>Client</div>
          <div>Joined</div>
          <div>Due</div>
          <div className="text-right">Fee</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Status</div>
        </div>
        {rows.map((p) => {
          const od = placementOverdue(p, now);
          const dd = daysUntilDue(p, now);
          return (
            <Link
              key={p.id}
              href={`/placements/${p.id}`}
              className="grid grid-cols-[1.4fr_1.1fr_105px_105px_130px_130px_120px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-[13px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold text-[#16203a]">{p.candidate_name}</div>
                {p.position && (
                  <div className="truncate text-[11px] font-medium text-[#a3acbd]">{p.position}</div>
                )}
              </div>
              <div className="truncate text-[12.5px] font-semibold text-[#42506b]">
                {(p.client_id ? clientName.get(p.client_id) : "") || p.client_name || "—"}
              </div>
              <div className="tf-num text-[12px] font-semibold text-[#42506b]">
                {format(new Date(p.joining_date + "T00:00:00"), "dd MMM yy")}
              </div>
              <div className={`tf-num text-[12px] font-semibold ${od ? "text-[#dc2626]" : "text-[#42506b]"}`}>
                {p.due_date ? format(new Date(p.due_date + "T00:00:00"), "dd MMM yy") : "—"}
                {OPEN_PLACEMENT_STATUSES.includes(p.status) && (
                  <span className="block text-[10px] font-bold">
                    {od ? `${-dd}d late` : dd >= 0 ? `in ${dd}d` : ""}
                  </span>
                )}
              </div>
              <div className="tf-num text-right text-[13px] font-extrabold">{money(p.total_fee)}</div>
              <div
                className={`tf-num text-right text-[13px] font-extrabold ${
                  placementBalance(p) > 0 && OPEN_PLACEMENT_STATUSES.includes(p.status)
                    ? "text-[#16203a]"
                    : "text-[#a3acbd]"
                }`}
              >
                {["cancelled", "written_off"].includes(p.status) ? "—" : money(placementBalance(p))}
              </div>
              <div className="text-right">
                <PlacementStatusBadge placement={p} />
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && (
          <div className="py-14 text-center text-[13px] font-semibold text-[#a3acbd]">
            No placements match this view.
          </div>
        )}
      </div>
    </div>
  );
}
