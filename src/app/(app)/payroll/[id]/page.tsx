import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/invoice";
import { monthLabel, PAYROLL_STATUS_META } from "@/lib/hr";
import { hexA } from "@/lib/domain";
import { PayrollSheet, PayrollActions } from "@/components/payroll-sheet";
import type { PayrollRunRow, PayrollLineRow, EmployeeRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/my/payslips");
  const { id } = await params;
  const sb = await createClient();
  const [{ data: run }, { data: lineData }, { data: empData }] = await Promise.all([
    sb.from("payroll_runs").select("*").eq("id", id).maybeSingle(),
    sb.from("payroll_lines").select("*").eq("run_id", id),
    sb.from("employees").select("*"),
  ]);
  if (!run) notFound();

  const employees = (empData ?? []) as EmployeeRow[];
  const empById = new Map(employees.map((e) => [e.id, e]));
  const lines = ((lineData ?? []) as PayrollLineRow[]).sort((a, b) =>
    (empById.get(a.employee_id)?.name ?? "").localeCompare(
      empById.get(b.employee_id)?.name ?? "",
    ),
  );

  const totalNet = lines.reduce((s, l) => s + l.net_pay, 0);
  const totalIncentive = lines.reduce((s, l) => s + l.incentive, 0);
  const totalGross = lines.reduce((s, l) => s + l.earned_gross, 0);
  const totalDed = lines.reduce(
    (s, l) => s + (l.deductions ?? []).reduce((x, d) => x + d.amount, 0),
    0,
  );
  const meta = PAYROLL_STATUS_META[(run as PayrollRunRow).status];

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
              {monthLabel((run as PayrollRunRow).period_month)}
            </h1>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ color: meta.color, background: hexA(meta.color, 0.12) }}
            >
              {meta.label}
            </span>
          </div>
          <p className="text-[13px] text-[#8a94a6]">
            {lines.length} employee{lines.length === 1 ? "" : "s"} ·{" "}
            {(run as PayrollRunRow).status === "paid"
              ? "payslips are visible to staff"
              : "click a row to adjust"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/payroll" className="text-[12.5px] font-bold text-[#2a6fdb] hover:underline">
            ← All runs
          </Link>
          <PayrollActions run={run as PayrollRunRow} />
        </div>
      </div>

      <div className="mb-[18px] grid grid-cols-4 gap-4">
        {[
          { label: "Earned gross", value: money(totalGross), color: "#2a6fdb" },
          { label: "Incentive", value: money(totalIncentive), color: "#8b5cf6" },
          { label: "Deductions", value: money(totalDed), color: "#dc2626" },
          { label: "Total net pay", value: money(totalNet), color: "#16a34a" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-[#e9edf3] bg-white p-[16px]">
            <div className="text-[11.5px] font-semibold text-[#8a94a6]">{c.label}</div>
            <div className="tf-num mt-1 text-[20px] font-extrabold" style={{ color: c.color }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <PayrollSheet run={run as PayrollRunRow} lines={lines} employees={employees} />
    </div>
  );
}
