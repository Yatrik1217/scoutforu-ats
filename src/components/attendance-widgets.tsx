"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { checkIn, checkOut, setAttendance } from "@/lib/actions/hr";
import { ATTENDANCE_META, ATTENDANCE_CYCLE, hoursWorked } from "@/lib/hr";
import { hexA } from "@/lib/domain";
import type { AttendanceRow, AttendanceStatus, EmployeeRow } from "@/lib/database.types";

// ---- self check-in / check-out -------------------------------------------------

export function CheckInCard({ today }: { today: AttendanceRow | null }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message || "Done");
        router.refresh();
      } else toast.error(res.error || "Failed");
    });

  const inAt = today?.check_in_at ? new Date(today.check_in_at) : null;
  const outAt = today?.check_out_at ? new Date(today.check_out_at) : null;
  const hrs = today ? hoursWorked(today) : null;
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <div className="rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[15px] font-extrabold text-[#16203a]">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-[12.5px] font-semibold text-[#7a8696]">
            <span>
              Check in{" "}
              <b className="tf-num text-[#16203a]">{inAt ? fmt(inAt) : "—"}</b>
            </span>
            <span>
              Check out{" "}
              <b className="tf-num text-[#16203a]">{outAt ? fmt(outAt) : "—"}</b>
            </span>
            {hrs != null && (
              <span className="rounded-full bg-[#e9f9ef] px-2.5 py-1 text-[11.5px] font-bold text-[#16a34a]">
                {hrs} hrs
              </span>
            )}
          </div>
        </div>
        {!inAt ? (
          <button
            onClick={() => run(checkIn)}
            disabled={pending}
            className="flex items-center gap-2 rounded-[10px] bg-[#16a34a] px-6 py-3 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,.3)] hover:bg-[#15803d] disabled:opacity-60"
          >
            <LogIn size={16} /> {pending ? "…" : "Check in"}
          </button>
        ) : !outAt ? (
          <button
            onClick={() => run(checkOut)}
            disabled={pending}
            className="flex items-center gap-2 rounded-[10px] bg-[#2a6fdb] px-6 py-3 text-[14px] font-bold text-white shadow-[0_4px_14px_rgba(42,111,219,.3)] hover:bg-[#245fc0] disabled:opacity-60"
          >
            <LogOut size={16} /> {pending ? "…" : "Check out"}
          </button>
        ) : (
          <span className="rounded-[10px] bg-[#f1f4f9] px-5 py-3 text-[13px] font-bold text-[#7a8696]">
            Day complete ✓
          </span>
        )}
      </div>
    </div>
  );
}

export function AttendancePill({ status }: { status: AttendanceStatus }) {
  const m = ATTENDANCE_META[status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ color: m.color, background: hexA(m.color, 0.12) }}
    >
      {m.label}
    </span>
  );
}

// ---- admin month register ------------------------------------------------------

export function AttendanceGrid({
  employees,
  rows,
  days,
  month,
}: {
  employees: EmployeeRow[];
  rows: AttendanceRow[];
  days: string[]; // ISO dates in the month
  month: string;
}) {
  const [local, setLocal] = useState<Record<string, AttendanceStatus | null>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  const key = (empId: string, date: string) => `${empId}|${date}`;
  const byKey = new Map(rows.map((r) => [key(r.employee_id, r.on_date), r.status]));

  const statusOf = (empId: string, date: string): AttendanceStatus | null => {
    const k = key(empId, date);
    return k in local ? local[k] : (byKey.get(k) ?? null);
  };

  const cycle = (empId: string, date: string) => {
    const cur = statusOf(empId, date);
    const idx = cur ? ATTENDANCE_CYCLE.indexOf(cur) : -1;
    const next = idx >= ATTENDANCE_CYCLE.length - 1 ? null : ATTENDANCE_CYCLE[idx + 1];
    setLocal((p) => ({ ...p, [key(empId, date)]: next }));
    start(async () => {
      const res = await setAttendance(empId, date, next);
      if (!res.ok) {
        toast.error(res.error || "Failed");
        setLocal((p) => {
          const c = { ...p };
          delete c[key(empId, date)];
          return c;
        });
      } else router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-3">
        <span className="text-[13px] font-extrabold text-[#16203a]">
          Register · {month}
        </span>
        <div className="flex flex-wrap items-center gap-2.5 text-[10.5px] font-bold">
          {ATTENDANCE_CYCLE.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[9px] text-white"
                style={{ background: ATTENDANCE_META[s].color }}
              >
                {ATTENDANCE_META[s].short}
              </span>
              <span className="text-[#7a8696]">{ATTENDANCE_META[s].label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[150px] border-b border-[#eef1f6] bg-[#f8fafc] px-4 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
                Employee
              </th>
              {days.map((d) => {
                const dow = new Date(d + "T00:00:00").getDay();
                return (
                  <th
                    key={d}
                    className={`border-b border-[#eef1f6] px-0 py-2 text-center text-[10px] font-bold ${
                      dow === 0 ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f8fafc] text-[#8a94a6]"
                    }`}
                    style={{ minWidth: 26 }}
                  >
                    {Number(d.slice(8))}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td className="sticky left-0 z-10 border-b border-[#f4f6fa] bg-white px-4 py-2 text-[12.5px] font-bold text-[#16203a]">
                  <div className="truncate">{e.name}</div>
                </td>
                {days.map((d) => {
                  const s = statusOf(e.id, d);
                  const meta = s ? ATTENDANCE_META[s] : null;
                  return (
                    <td key={d} className="border-b border-[#f4f6fa] p-0 text-center">
                      <button
                        onClick={() => cycle(e.id, d)}
                        disabled={pending}
                        title={`${e.name} · ${d}${meta ? ` · ${meta.label}` : ""} — click to change`}
                        className="mx-auto my-1 flex h-[22px] w-[22px] items-center justify-center rounded-[5px] text-[9.5px] font-extrabold transition hover:ring-2 hover:ring-[#cbd7ea]"
                        style={
                          meta
                            ? { background: meta.color, color: "#fff" }
                            : { background: "#f1f4f9", color: "#c2cad8" }
                        }
                      >
                        {meta ? meta.short : "·"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {employees.length === 0 && (
        <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
          No active employees.
        </div>
      )}
      <div className="border-t border-[#eef1f6] px-5 py-2.5 text-[11.5px] text-[#8a94a6]">
        Click any day to cycle through the statuses. <b>Absent</b> counts as a full loss-of-pay day
        and <b>Half day</b> as ½ — combined with unpaid leave, never double-counted.
      </div>
    </div>
  );
}
