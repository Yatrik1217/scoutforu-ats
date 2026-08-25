"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useShell } from "@/components/shell-provider";
import { Avatar } from "@/components/bits";

type Person = { id: string; name: string };
type DayCell = { day: string; added: Person[]; sub: Person[] };
type Row = { id: string; name: string; days: DayCell[]; totAdded: number; totSub: number };

const dayLabel = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function ActivityGrid({
  rows,
  days,
  todayISO,
  span,
}: {
  rows: Row[];
  days: string[];
  todayISO: string;
  span: number;
}) {
  const { openDrawer } = useShell();
  const [open, setOpen] = useState<{ recId: string; day: string } | null>(null);
  const gridStyle = { gridTemplateColumns: `1.3fr repeat(${span}, minmax(30px, 1fr)) 66px` };

  const rec = open ? rows.find((r) => r.id === open.recId) : null;
  const cell = rec ? rec.days.find((d) => d.day === open!.day) : null;

  const NameList = ({ items, color }: { items: Person[]; color: string }) => (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => openDrawer(p.id)}
          className="rounded-full border border-[#e6eaf1] bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-[#c3d4f0] hover:bg-[#f6f8fb]"
          style={{ color }}
        >
          {p.name}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-[#e9edf3] bg-white">
        <div className="min-w-max">
          <div
            className="grid gap-1 border-b border-[#eef1f6] bg-[#f8fafc] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-[#8a94a6]"
            style={gridStyle}
          >
            <div>Recruiter</div>
            {days.map((d) => (
              <div key={d} className={`text-center ${d === todayISO ? "text-[#2a6fdb]" : ""}`}>
                {dayLabel(d)}
              </div>
            ))}
            <div className="text-right">Total</div>
          </div>

          {rows.map((r) => (
            <div
              key={r.id}
              className="grid items-center gap-1 border-b border-[#f4f6fa] px-4 py-2.5 last:border-0"
              style={gridStyle}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={r.name} size={26} />
                <div className="truncate text-[12.5px] font-bold text-[#16203a]">{r.name}</div>
              </div>
              {r.days.map((x) => {
                const has = x.added.length || x.sub.length;
                const active = open?.recId === r.id && open?.day === x.day;
                return (
                  <button
                    key={x.day}
                    disabled={!has}
                    onClick={() => setOpen(active ? null : { recId: r.id, day: x.day })}
                    title={has ? `${x.added.length} added · ${x.sub.length} submitted — click for names` : ""}
                    className={`rounded-[6px] py-1 text-center transition ${
                      active
                        ? "bg-[#2a6fdb] "
                        : x.day === todayISO
                          ? "bg-[#eef4fe] "
                          : has
                            ? "bg-[#f7f9fc] hover:bg-[#eef4fe] "
                            : ""
                    }${has ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div
                      className={`tf-num text-[12px] font-extrabold leading-none ${active ? "text-white" : "text-[#2a6fdb]"}`}
                    >
                      {x.sub.length || (x.added.length ? "" : "·")}
                    </div>
                    {x.added.length > 0 && (
                      <div
                        className={`tf-num text-[9.5px] font-semibold leading-tight ${active ? "text-white/85" : "text-[#16a34a]"}`}
                      >
                        +{x.added.length}
                      </div>
                    )}
                  </button>
                );
              })}
              <div className="text-right leading-tight">
                <div className="tf-num text-[13px] font-extrabold text-[#2a6fdb]">{r.totSub}</div>
                <div className="tf-num text-[10px] font-semibold text-[#16a34a]">+{r.totAdded}</div>
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
              No recruiters yet.
            </div>
          )}
        </div>
      </div>

      {rec && cell && (
        <div className="mt-3 rounded-2xl border border-[#dbe6fb] bg-[#f8fbff] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13.5px] font-extrabold text-[#16203a]">
              {rec.name} · {dayLabel(cell.day)}
            </div>
            <button
              onClick={() => setOpen(null)}
              className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#9aa4b6] hover:bg-white"
            >
              <X size={15} />
            </button>
          </div>
          {cell.sub.length > 0 && (
            <div className="mb-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#2a6fdb]">
                Submitted to client ({cell.sub.length})
              </div>
              <NameList items={cell.sub} color="#2a6fdb" />
            </div>
          )}
          {cell.added.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#16a34a]">
                Candidates added ({cell.added.length})
              </div>
              <NameList items={cell.added} color="#16a34a" />
            </div>
          )}
          {cell.sub.length === 0 && cell.added.length === 0 && (
            <div className="text-[12.5px] text-[#8a94a6]">Nothing recorded this day.</div>
          )}
          <p className="mt-3 text-[11px] text-[#8a94a6]">Click a name to open the candidate.</p>
        </div>
      )}
    </>
  );
}
