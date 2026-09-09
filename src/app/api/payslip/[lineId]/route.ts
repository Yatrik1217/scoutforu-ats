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

// Payslip PDF. The admin (master_admin) can render any line for any run; an
// employee can render only their own line, and only once the run is PAID — a
// draft or finalised-but-unpaid run is still being worked on and must not be
// downloadable by the employee, even by guessing the URL.
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

  const [{ data: run }, { data: employee }, { data: org }, { data: profile }] =
    await Promise.all([
      sb.from("payroll_runs").select("*").eq("id", (line as PayrollLineRow).run_id).maybeSingle(),
      sb.from("employees").select("*").eq("id", (line as PayrollLineRow).employee_id).maybeSingle(),
      sb.from("organization").select("*").maybeSingle(),
      sb.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
  if (!run || !employee) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Non-admins may only download their OWN payslip, and only when it is paid.
  const isAdmin = (profile as { role?: string } | null)?.role === "master_admin";
  if (!isAdmin) {
    const ownsLine = (employee as EmployeeRow).profile_id === user.id;
    if (!ownsLine || (run as PayrollRunRow).status !== "paid") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

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
