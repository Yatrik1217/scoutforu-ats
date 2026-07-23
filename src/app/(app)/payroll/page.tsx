import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/invoice";
import { monthLabel, PAYROLL_STATUS_META } from "@/lib/hr";
import { hexA } from "@/lib/domain";
import { NewPayrollButton } from "@/components/payroll-sheet";
import type { PayrollRunRow, PayrollLineRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/my/payslips");
  const sb = await createClient();
  const [{ data: runData }, { data: lineData }] = await Promise.all([
    sb.from("payroll_runs").select("*").order("period_month", { ascending: false }),
    sb.from("payroll_lines").select("run_id,net_pay,incentive"),
  ]);
  const runs = (runData ?? []) as PayrollRunRow[];
  const lines = (lineData ?? []) as Pick<PayrollLineRow, "run_id" | "net_pay" | "incentive">[];

  const totals = new Map<string, { net: number; incentive: number; count: number }>();
  for (const l of lines) {
    const t = totals.get(l.run_id) ?? { net: 0, incentive: 0, count: 0 };
    t.net += l.net_pay;
    t.incentive += l.incentive;
    t.count += 1;
    totals.set(l.run_id, t);
  }

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Payroll
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Monthly salary runs — leave and incentives are pulled in automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/employees"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Employees
          </Link>
          <NewPayrollButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e9edf3] bg-white">
        <div className="grid grid-cols-[1.2fr_100px_140px_140px_130px] gap-2 border-b border-[#eef1f6] bg-[#f8fafc] px-5 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#8a94a6]">
          <div>Month</div>
          <div className="text-center">Staff</div>
          <div className="text-right">Incentive</div>
          <div className="text-right">Total net pay</div>
          <div className="text-right">Status</div>
        </div>
        {runs.map((r) => {
          const t = totals.get(r.id) ?? { net: 0, incentive: 0, count: 0 };
          const meta = PAYROLL_STATUS_META[r.status];
          return (
            <Link
              key={r.id}
              href={`/payroll/${r.id}`}
              className="grid grid-cols-[1.2fr_100px_140px_140px_130px] items-center gap-2 border-b border-[#f4f6fa] px-5 py-[13px] last:border-0 hover:bg-[#f6f8fb]"
            >
              <div className="text-[13.5px] font-extrabold text-[#16203a]">
                {monthLabel(r.period_month)}
              </div>
              <div className="tf-num text-center text-[13px] font-bold">{t.count}</div>
              <div className="tf-num text-right text-[13px] font-bold text-[#8b5cf6]">
                {t.incentive ? money(t.incentive) : "—"}
              </div>
              <div className="tf-num text-right text-[13.5px] font-extrabold">{money(t.net)}</div>
              <div className="text-right">
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ color: meta.color, background: hexA(meta.color, 0.12) }}
                >
                  {meta.label}
                </span>
              </div>
            </Link>
          );
        })}
        {runs.length === 0 && (
          <div className="py-14 text-center text-[13px] font-semibold text-[#a3acbd]">
            No payroll runs yet — pick a month above and run your first.
          </div>
        )}
      </div>
    </div>
  );
}
