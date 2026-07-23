import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPayslipPdf } from "@/lib/payslip-doc";
import { fetchLogoBytes } from "@/lib/invoice-doc";
import { monthLabel } from "@/lib/hr";
import type {
  EmployeeRow,
  PayrollLineRow,
  PayrollRunRow,
  OrganizationRow,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

// Payslip PDF. RLS decides visibility: the admin sees every line, an employee
// only their own, and only once the run has left draft.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ lineId: string }> },
) {
  const { lineId } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: line } = await sb
    .from("payroll_lines")
    .select("*")
    .eq("id", lineId)
    .maybeSingle();
  if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: run }, { data: employee }, { data: org }] = await Promise.all([
    sb.from("payroll_runs").select("*").eq("id", (line as PayrollLineRow).run_id).maybeSingle(),
    sb.from("employees").select("*").eq("id", (line as PayrollLineRow).employee_id).maybeSingle(),
    sb.from("organization").select("*").maybeSingle(),
  ]);
  if (!run || !employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logoBytes = await fetchLogoBytes((org as OrganizationRow | null)?.logo_url);
  const pdf = buildPayslipPdf({
    line: line as PayrollLineRow,
    employee: employee as EmployeeRow,
    run: run as PayrollRunRow,
    org: org as OrganizationRow | null,
    logoBytes,
  });

  const name = `Payslip ${monthLabel((run as PayrollRunRow).period_month)} - ${
    (employee as EmployeeRow).name
  }`.replace(/[^\w .-]+/g, " ");

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
