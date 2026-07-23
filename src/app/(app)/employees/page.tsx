import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EmployeeManager } from "@/components/employee-manager";
import type { EmployeeRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const me = await requireProfile();
  if (me.role !== "master_admin") redirect("/overview");
  const sb = await createClient();
  const [{ data: employees }, { data: logins }, { data: pendingLeave }] = await Promise.all([
    sb.from("employees").select("*").order("status").order("name"),
    sb.from("profiles").select("id,name,email").neq("role", "client").order("name"),
    sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  void pendingLeave;

  return (
    <div className="animate-sc-fadein p-[24px_26px_40px]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-extrabold tracking-tight text-[#16203a]">
            Employees
          </h1>
          <p className="text-[13px] text-[#8a94a6]">
            Staff records, salary and everything payroll runs on.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/leaves"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Leave requests
          </Link>
          <Link
            href="/payroll"
            className="rounded-[10px] border border-[#e6eaf1] bg-white px-4 py-2.5 text-[13px] font-bold text-[#42506b] hover:bg-[#f6f8fb]"
          >
            Payroll
          </Link>
        </div>
      </div>
      <EmployeeManager
        employees={(employees ?? []) as EmployeeRow[]}
        logins={logins ?? []}
      />
    </div>
  );
}
