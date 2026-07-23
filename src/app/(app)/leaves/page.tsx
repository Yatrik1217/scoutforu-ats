import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/bits";
import {
  ApplyLeaveButton,
  LeaveDecisionButtons,
  LeaveStatusBadge,
} from "@/components/leave-manager";
import { leaveBalances } from "@/lib/hr";
import { fyStartYear, fyRange } from "@/lib/incentive";
import type { EmployeeRow, LeaveRequestRow, LeaveTypeRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const fmtD = (d: string) => format(new Date(d + "T00:00:00"), "dd MMM yy");

export default async function LeavesPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/my/leave");
  const { f = "pending" } = await searchParams;

  const sb = await createClient();
  const [{ data: reqData }, { data: empData }, { data: typeData }] = await Promise.all([
    sb.from("leave_requests").select("*").order("created_at", { ascending: false }),
    sb.from("employees").select("*").order("name"),
    sb.from("leave_types").select("*").order("sort"),
  ]);
  const requests = (reqData ?? []) as LeaveRequestRow[];
  const employees = (empData ?? []) as EmployeeRow[];
  const types = (typeData ?? []) as LeaveTypeRow[];
  const empById = new Map(employees.map((e) => [e.id, e]));
  const typeById = new Map(types.map((t) => [t.id, t]));

  const filtered =
    f === "all" ? requests : requests.filter((r) => r.status === (f as LeaveRequestRow["status"]));
  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const range = fyRange(fyStartYear(new Date()));

  const TABS = [
    { key: "pending", label: `Pending${pendingCount ? ` (${pendingCount})` : ""}` },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Leave Requests
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Approve or reject staff leave. Unpaid leave flows into payroll as loss of pay.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/employees"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            ← Employees
          </Link>
          <ApplyLeaveButton
            types={types.filter((t) => t.active)}
            employees={employees.filter((e) => e.status === "active").map((e) => ({ id: e.id, name: e.name }))}
            asAdmin
            label="Record leave"
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-[11px] bg-[#e6eaf1] p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/leaves?f=${t.key}`}
            className={`rounded-[8px] px-3.5 py-1.5 text-[12.5px] font-bold transition ${
              f === t.key ? "bg-white text-[#16203a] shadow-sm" : "text-[#68758c] hover:text-[#42506b]"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.4fr_1fr_190px_70px_1fr_170px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Employee</div>
          <div>Type</div>
          <div>Dates</div>
          <div className="text-center">Days</div>
          <div>Reason</div>
          <div className="text-right">Status</div>
        </div>
        {filtered.map((r) => {
          const emp = empById.get(r.employee_id);
          const type = typeById.get(r.leave_type_id);
          return (
            <div
              key={r.id}
              className="grid grid-cols-[1.4fr_1fr_190px_70px_1fr_170px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-3 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={emp?.name ?? "—"} size={30} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-bold text-[#16203a]">
                    {emp?.name ?? "—"}
                  </div>
                  <div className="truncate text-[10.5px] text-[#a3acbd]">
                    {emp?.designation || ""}
                  </div>
                </div>
              </div>
              <div className="text-[12px] font-semibold text-[#42506b]">
                {type?.name ?? "—"}
                {type && !type.paid && (
                  <span className="ml-1 text-[10px] font-bold text-[#dc2626]">unpaid</span>
                )}
              </div>
              <div className="tf-num text-[12px] font-semibold text-[#42506b]">
                {fmtD(r.from_date)}
                {r.from_date !== r.to_date ? ` – ${fmtD(r.to_date)}` : ""}
                {r.half_day && <span className="ml-1 text-[10px] text-[#8a94a6]">½</span>}
              </div>
              <div className="tf-num text-center text-[13px] font-extrabold">{r.days}</div>
              <div className="truncate text-[11.5px] text-[#7a8696]" title={r.reason}>
                {r.reason || "—"}
              </div>
              <div className="flex items-center justify-end">
                {r.status === "pending" ? (
                  <LeaveDecisionButtons id={r.id} />
                ) : (
                  <LeaveStatusBadge status={r.status} />
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            {f === "pending" ? "Nothing waiting for approval 🎉" : "No requests here."}
          </div>
        )}
      </div>

      {/* balances */}
      <div className="mt-[18px] rounded-2xl border border-[#e9edf3] bg-white p-[22px]">
        <div className="text-[15px] font-extrabold">Balances · {range.label}</div>
        <div className="mb-3 text-[12px] font-medium text-[#8a94a6]">
          Approved leave taken against each employee&apos;s annual quota
        </div>
        <div className="grid grid-cols-2 gap-3">
          {employees
            .filter((e) => e.status === "active")
            .map((e) => {
              const bal = leaveBalances(
                types,
                requests.filter((r) => r.employee_id === e.id),
                range,
              );
              return (
                <div key={e.id} className="rounded-[10px] border border-[#eef1f6] p-3.5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <Avatar name={e.name} size={28} />
                    <span className="text-[12.5px] font-bold text-[#16203a]">{e.name}</span>
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
                        <span className="text-[#a3acbd]">
                          {b.type.paid ? ` / ${b.quota}` : " taken"}
                        </span>
                        {b.overQuota > 0 && (
                          <span className="ml-1 font-bold text-[#dc2626]">
                            +{b.overQuota} over
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
