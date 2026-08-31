"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { X, CalendarDays } from "lucide-react";
import { Avatar } from "@/components/bits";
import { LeaveStatusBadge } from "@/components/leave-manager";
import { leaveBalances, onProbation, probationEndsOn, LEAVE_STATUS_META } from "@/lib/hr";
import type { LeaveRequestRow, LeaveTypeRow } from "@/lib/database.types";

// The subset of an employee this view needs (kept small — no payroll/bank data
// crosses to the client).
export type LeaveEmp = {
  id: string;
  name: string;
  designation: string;
  joined_on: string | null;
  probation_months: number;
};

type Range = { from: string; to: string; label: string };

const fmtD = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM yy");

export function LeaveBalancesGrid({
  employees,
  requests,
  types,
  range,
}: {
  employees: LeaveEmp[];
  requests: LeaveRequestRow[];
  types: LeaveTypeRow[];
  range: Range;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = employees.find((e) => e.id === openId) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {employees.map((e) => {
          const bal = leaveBalances(
            types,
            requests.filter((r) => r.employee_id === e.id),
            range,
          );
          return (
            <button
              key={e.id}
              onClick={() => setOpenId(e.id)}
              className="rounded-[10px] border border-[#eef1f6] p-3.5 text-left transition hover:border-[#c9d8f2] hover:bg-[#f8faff] hover:shadow-[0_2px_10px_rgba(42,111,219,.08)]"
            >
              <div className="mb-2 flex items-center gap-2.5">
                <Avatar name={e.name} size={28} />
                <span className="text-[12.5px] font-bold text-[#16203a]">{e.name}</span>
                {onProbation(e) && (
                  <span className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[10px] font-bold text-[#b45309]">
                    On probation till {probationEndsOn(e)}
                  </span>
                )}
                <span className="ml-auto text-[10.5px] font-bold text-[#a3acbd]">View →</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {bal.map((b) => (
                  <div
                    key={b.type.id}
                    className="rounded-[8px] bg-[#f8fafc] px-2.5 py-1.5 text-[11px]"
                    title={`${b.taken} taken of ${b.quota}`}
                  >
                    <span className="font-bold text-[#42506b]">{b.type.code}</span>{" "}
                    <span className="tf-num font-extrabold text-[#16203a]">
                      {b.type.paid ? b.remaining : b.taken}
                    </span>
                    <span className="text-[#a3acbd]">{b.type.paid ? ` / ${b.quota}` : " taken"}</span>
                    {b.overQuota > 0 && (
                      <span className="ml-1 font-bold text-[#dc2626]">+{b.overQuota} over</span>
                    )}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <LeaveDetailModal
          emp={selected}
          requests={requests.filter((r) => r.employee_id === selected.id)}
          types={types}
          range={range}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

type LedgerEntry = {
  req: LeaveRequestRow;
  typeName: string;
  typeCode: string;
  paid: boolean;
  balanceAfter: number | null; // running remaining for paid types after an approved leave
  quota: number;
};

function LeaveDetailModal({
  emp,
  requests,
  types,
  range,
  onClose,
}: {
  emp: LeaveEmp;
  requests: LeaveRequestRow[];
  types: LeaveTypeRow[];
  range: Range;
  onClose: () => void;
}) {
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const bal = useMemo(
    () => leaveBalances(types, requests, range),
    [types, requests, range],
  );

  // Requests inside the FY, oldest first — the timeline reads top→bottom.
  const inFY = useMemo(
    () =>
      requests
        .filter((r) => r.from_date <= range.to && r.to_date >= range.from)
        .sort((a, b) => a.from_date.localeCompare(b.from_date)),
    [requests, range],
  );

  // Walk the requests, keeping a running balance per paid leave type so each
  // approved leave shows the balance it left behind.
  const ledger: LedgerEntry[] = useMemo(() => {
    const remaining = new Map<string, number>();
    for (const t of types) if (t.paid) remaining.set(t.id, t.annual_quota);
    return inFY.map((r) => {
      const t = typeById.get(r.leave_type_id);
      const paid = !!t?.paid;
      let balanceAfter: number | null = null;
      if (paid && r.status === "approved") {
        const cur = remaining.get(r.leave_type_id) ?? 0;
        const next = Math.round((cur - r.days) * 100) / 100;
        remaining.set(r.leave_type_id, next);
        balanceAfter = next;
      }
      return {
        req: r,
        typeName: t?.name ?? "Leave",
        typeCode: t?.code ?? "",
        paid,
        balanceAfter,
        quota: t?.annual_quota ?? 0,
      };
    });
  }, [inFY, types, typeById]);

  const probEnd = probationEndsOn(emp);
  const onProb = onProbation(emp);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden rounded-[16px] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-[#eef1f6] px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar name={emp.name} size={38} />
            <div>
              <div className="text-[15px] font-extrabold text-[#16203a]">{emp.name}</div>
              <div className="text-[11.5px] text-[#8a94a6]">
                {emp.designation || "—"}
                {emp.joined_on ? ` · joined ${fmtD(emp.joined_on)}` : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9aa4b6] hover:text-[#42506b]">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {/* balance summary */}
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#8a94a6]">
            Balance · {range.label}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            {bal.map((b) => (
              <div key={b.type.id} className="rounded-[11px] border border-[#eef1f6] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#42506b]">{b.type.name}</span>
                  {!b.type.paid && (
                    <span className="text-[10px] font-bold text-[#dc2626]">unpaid</span>
                  )}
                </div>
                {b.type.paid ? (
                  <>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <span className="tf-num text-[22px] font-extrabold text-[#16203a]">
                        {b.remaining}
                      </span>
                      <span className="text-[12px] font-bold text-[#a3acbd]">/ {b.quota} left</span>
                    </div>
                    <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-[#eef1f6]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (b.taken / Math.max(1, b.quota)) * 100)}%`,
                          background: b.overQuota > 0 ? "#dc2626" : "#2a6fdb",
                        }}
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] font-semibold text-[#8a94a6]">
                      {b.taken} accrued-quota used
                      {b.pending > 0 && ` · ${b.pending} pending`}
                      {b.overQuota > 0 && (
                        <span className="text-[#dc2626]"> · {b.overQuota} over quota</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <span className="tf-num text-[22px] font-extrabold text-[#16203a]">
                      {b.taken}
                    </span>
                    <span className="text-[12px] font-bold text-[#a3acbd]">days taken (LOP)</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* timeline */}
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#8a94a6]">
            Timeline
          </div>
          <div className="relative pl-6">
            {/* the spine */}
            <span className="absolute bottom-2 left-[7px] top-2 w-px bg-[#e9edf3]" />

            {/* opening node — entitlement granted at FY start */}
            <TimelineDot color="#2a6fdb" />
            <div className="pb-4">
              <div className="text-[12.5px] font-bold text-[#16203a]">
                {range.label} began
              </div>
              <div className="text-[11.5px] text-[#7a8696]">
                {bal
                  .filter((b) => b.type.paid)
                  .map((b) => `${b.quota} ${b.type.name}`)
                  .join(" · ") || "No paid leave types"}{" "}
                available
                {onProb && probEnd && (
                  <span className="text-[#b45309]">
                    {" "}
                    · paid leave unlocks after probation ({probEnd})
                  </span>
                )}
              </div>
            </div>

            {ledger.map((l) => {
              const r = l.req;
              const dot =
                r.status === "approved"
                  ? LEAVE_STATUS_META.approved.color
                  : r.status === "pending"
                    ? LEAVE_STATUS_META.pending.color
                    : "#c2cad8";
              const dim = r.status === "rejected" || r.status === "cancelled";
              return (
                <div key={r.id} className="relative">
                  <TimelineDot color={dot} />
                  <div className={`pb-4 ${dim ? "opacity-55" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="tf-num text-[12.5px] font-bold text-[#16203a]">
                        {fmtD(r.from_date)}
                        {r.from_date !== r.to_date ? ` – ${fmtD(r.to_date)}` : ""}
                      </span>
                      <span className="rounded-md bg-[#eef2f8] px-1.5 py-[2px] text-[10.5px] font-bold text-[#556680]">
                        {l.typeName}
                      </span>
                      <span
                        className={`tf-num text-[11.5px] font-extrabold ${
                          l.paid ? "text-[#2a6fdb]" : "text-[#dc2626]"
                        }`}
                      >
                        {r.status === "approved" ? "−" : ""}
                        {r.days} day{r.days === 1 ? "" : "s"}
                        {r.half_day ? " (½)" : ""}
                      </span>
                      <LeaveStatusBadge status={r.status} />
                      {l.balanceAfter !== null && (
                        <span className="ml-auto text-[11px] font-bold text-[#8a94a6]">
                          balance{" "}
                          <span className="tf-num text-[#16203a]">
                            {l.balanceAfter} / {l.quota}
                          </span>
                        </span>
                      )}
                    </div>
                    {r.reason && (
                      <div className="mt-0.5 text-[11.5px] text-[#7a8696]">{r.reason}</div>
                    )}
                    {r.decision_note && (
                      <div className="mt-0.5 text-[11px] italic text-[#a3acbd]">
                        Note: {r.decision_note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {ledger.length === 0 && (
              <>
                <TimelineDot color="#c2cad8" />
                <div className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold text-[#a3acbd]">
                  <CalendarDays size={13} /> No leave taken this year yet.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineDot({ color }: { color: string }) {
  return (
    <span
      className="absolute left-0 top-[3px] h-[15px] w-[15px] rounded-full border-[3px] border-white"
      style={{ background: color, boxShadow: `0 0 0 1.5px ${color}` }}
    />
  );
}
