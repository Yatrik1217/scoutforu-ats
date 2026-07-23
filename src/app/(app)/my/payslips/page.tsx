import { Download } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/invoice";
import { monthLabel } from "@/lib/hr";
import type { EmployeeRow, PayrollLineRow, PayrollRunRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function MyPayslipsPage() {
  await requireProfile();
  const sb = await createClient();
  const { data: emp } = await sb.from("employees").select("*").maybeSingle();
  const employee = emp as EmployeeRow | null;

  // RLS returns only this employee's lines, and only for non-draft runs.
  const [{ data: lineData }, { data: runData }] = await Promise.all([
    sb.from("payroll_lines").select("*"),
    sb.from("payroll_runs").select("*").order("period_month", { ascending: false }),
  ]);
  const runs = (runData ?? []) as PayrollRunRow[];
  const runById = new Map(runs.map((r) => [r.id, r]));
  const lines = ((lineData ?? []) as PayrollLineRow[])
    .filter((l) => runById.has(l.run_id))
    .sort((a, b) =>
      (runById.get(b.run_id)?.period_month ?? "").localeCompare(
        runById.get(a.run_id)?.period_month ?? "",
      ),
    );

  if (!employee) {
    return (
      <div className="animate-sc-fadein p-[24px_26px_40px]">
        <h1 className="font-display text-[22px] font-extrabold text-[#16203a]">My Payslips</h1>
        <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-6 text-[13px] font-semibold text-[#92400e]">
          No employee record is linked to your login yet. Ask the admin to link your account under
          Employees.
        </div>
      </div>
    );
  }

  const ytd = lines.reduce((s, l) => s + l.net_pay, 0);

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5">
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
          My Payslips
        </h1>
        <p className="text-[13px] text-[#8a94a6]">
          {lines.length} payslip{lines.length === 1 ? "" : "s"} · {money(ytd)} received in total
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.2fr_120px_120px_120px_130px_110px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Month</div>
          <div className="text-right">Earned</div>
          <div className="text-right">Incentive</div>
          <div className="text-right">Deductions</div>
          <div className="text-right">Net pay</div>
          <div className="text-right">Payslip</div>
        </div>
        {lines.map((l) => {
          const run = runById.get(l.run_id)!;
          const ded = (l.deductions ?? []).reduce((s, d) => s + d.amount, 0);
          return (
            <div
              key={l.id}
              className="grid grid-cols-[1.2fr_120px_120px_120px_130px_110px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-[13px] last:border-0"
            >
              <div>
                <div className="text-[13px] font-extrabold text-[#16203a]">
                  {monthLabel(run.period_month)}
                </div>
                {l.lop_days > 0 && (
                  <div className="text-[10.5px] font-semibold text-[#dc2626]">
                    {l.lop_days} LOP day{l.lop_days === 1 ? "" : "s"}
                  </div>
                )}
              </div>
              <div className="tf-num text-right text-[12.5px]">{money(l.earned_gross)}</div>
              <div className="tf-num text-right text-[12.5px] font-bold text-[#8b5cf6]">
                {l.incentive ? money(l.incentive) : "—"}
              </div>
              <div className="tf-num text-right text-[12.5px] text-[#dc2626]">
                {ded ? money(ded) : "—"}
              </div>
              <div className="tf-num text-right text-[13.5px] font-extrabold">
                {money(l.net_pay)}
              </div>
              <div className="flex justify-end">
                <a
                  href={`/api/payslip/${l.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-[8px] bg-[#eef4fe] px-3 py-1.5 text-[11.5px] font-bold text-[#2a6fdb] hover:bg-[#e0ebfd]"
                >
                  <Download size={13} /> PDF
                </a>
              </div>
            </div>
          );
        })}
        {lines.length === 0 && (
          <div className="py-12 text-center text-[13px] font-semibold text-[#a3acbd]">
            No payslips published yet.
          </div>
        )}
      </div>
    </div>
  );
}
